'use node'

import process from 'node:process'
import { action, internalAction } from './_generated/server'
import { api } from './_generated/api'
import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { FirecrawlClient } from 'firecrawl'
import { AgentMailClient } from 'agentmail'
import {
  renderAcknowledgmentEmail,
  renderOutreachEmail,
  renderVendorReplyEmail,
  renderExecutiveSummaryEmail,
  renderDecisionRequiredEmail,
} from './templates'

const extractEmail = (fromStr: string): string => {
  if (!fromStr) return ''
  const match = fromStr.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  return fromStr.trim().toLowerCase()
}

const getDashboardUrl = (jobId: string) => {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.CONVEX_SITE_URL ||
    'https://energetic-koala-352.convex.site'
  return `${base.replace(/\/$/, '')}/jobs?job=${jobId}`
}

const getGeminiModel = () => {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY')
  }
  const google = createGoogleGenerativeAI({ apiKey: key })
  return google('gemini-3.6-flash')
}

const getFirecrawl = () => {
  return new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY || '' })
}

const getAgentMail = () => {
  return new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY || '' })
}

let rateLimitedUntil = 0

const safeSend = async (
  inboxId: string,
  opts: { to: string[]; subject: string; text: string; html?: string },
): Promise<boolean> => {
  if (Date.now() < rateLimitedUntil) return false
  try {
    await getAgentMail().inboxes.messages.send(inboxId, opts)
    return true
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 429) {
      const body = (err as { body?: { window?: string } }).body
      rateLimitedUntil =
        Date.now() + (body?.window === 'daily' ? 3600000 : 60000)
    }
    return false
  }
}

const ensureWebhookRegistered = async () => {
  try {
    const siteUrl =
      process.env.CONVEX_SITE_URL || 'https://energetic-koala-352.convex.site'
    const webhookUrl = `${siteUrl.replace(/\/$/, '')}/webhook/agentmail`
    const client = getAgentMail()
    const list = await client.webhooks.list()
    const exists = list.webhooks?.some(w => w.url === webhookUrl)
    if (!exists) {
      await client.webhooks.create({
        url: webhookUrl,
        eventTypes: ['message.received'],
      })
    }
  } catch (err) {
    console.warn('Webhook registration note:', err)
  }
}

const sanitizeEmailBody = (text: string): string => {
  let cleaned = text
    .replace(/\[(?:your\s+)?name\]/gi, 'Relay Sourcing Team')
    .replace(/\[(?:your\s+)?phone(?:\s+number)?\]/gi, '')
    .replace(/\[(?:your\s+)?company(?:\s+name)?\]/gi, 'Relay')
    .replace(/\[(?:your\s+)?title\]/gi, 'Procurement Coordinator')
    .replace(/\[(?:insert\s+)?date\]/gi, 'as soon as possible')
    .replace(/\[[^\]]+\]/g, '')

  cleaned = cleaned
    .split('\n')
    .map(line => line.trimEnd())
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim()

  if (
    !cleaned.toLowerCase().includes('best regards') &&
    !cleaned.toLowerCase().includes('sincerely')
  ) {
    cleaned += '\n\nBest regards,\nRelay Sourcing Team'
  }

  return cleaned
}

type Vendor = {
  name: string
  url?: string
  description?: string
  email?: string
  phone?: string
}

type ParsedIntent = {
  taskType: string
  description: string
  targetCount?: number
  location?: string
  budget?: string
  deadline?: string
  category?: string
}

export const parseTask = action({
  args: { jobId: v.id('jobs'), rawTask: v.string(), userEmail: v.string() },
  handler: async (ctx, { jobId, rawTask }) => {
    await ctx.runMutation(api.jobs.updateJobStatus, {
      jobId,
      status: 'parsing',
    })

    let parsed: ParsedIntent
    try {
      const { text } = await generateText({
        model: getGeminiModel(),
        prompt: `You are an intent parser for Relay, an autonomous sourcing agent.
Extract structured intent from the user task. Return ONLY a valid JSON object without markdown formatting:
{
  "taskType": "sourcing",
  "description": "concise one-sentence description",
  "targetCount": 3,
  "location": "city or region if mentioned, else null",
  "budget": "budget constraint if mentioned, else null",
  "deadline": "deadline if mentioned, else null",
  "category": "type of service e.g. catering, cleaning, photography"
}

Task: "${rawTask}"`,
      })

      const clean = text
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim()
      const raw = JSON.parse(clean)
      parsed = {
        taskType: typeof raw.taskType === 'string' ? raw.taskType : 'sourcing',
        description:
          typeof raw.description === 'string'
            ? raw.description
            : rawTask.slice(0, 100),
        targetCount: typeof raw.targetCount === 'number' ? raw.targetCount : 3,
        location: typeof raw.location === 'string' ? raw.location : undefined,
        budget: typeof raw.budget === 'string' ? raw.budget : undefined,
        deadline: typeof raw.deadline === 'string' ? raw.deadline : undefined,
        category: typeof raw.category === 'string' ? raw.category : 'services',
      }
    } catch {
      parsed = {
        taskType: 'sourcing',
        description: rawTask.slice(0, 100),
        targetCount: 3,
        category: 'services',
      }
    }

    let agentInboxId = ''
    let agentEmail = ''

    try {
      const inboxesList = await getAgentMail().inboxes.list()
      const firstInbox = inboxesList.inboxes?.[0]
      if (firstInbox) {
        agentInboxId = firstInbox.inboxId
        agentEmail = firstInbox.email
        try {
          await getAgentMail().inboxes.update(agentInboxId, {
            displayName: 'Relay',
          })
        } catch {}
      } else {
        const inbox = await getAgentMail().inboxes.create({
          displayName: 'Relay',
        })
        agentInboxId = inbox.inboxId
        agentEmail = inbox.email
      }
      await ensureWebhookRegistered()
    } catch (err) {
      console.error('AGENTMAIL_INIT_ERROR:', err)
      throw new Error(
        `Failed to initialize AgentMail inbox: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    await ctx.runMutation(api.jobs.updateJobParsed, {
      jobId,
      parsedIntent: parsed,
      agentInboxId,
      agentEmail,
    })

    return { parsed, agentInboxId, agentEmail }
  },
})

export const researchVendors = action({
  args: {
    jobId: v.id('jobs'),
    category: v.string(),
    location: v.optional(v.string()),
    targetCount: v.number(),
  },
  handler: async (
    ctx,
    { jobId, category, location, targetCount },
  ): Promise<{ vendors: Vendor[] }> => {
    await ctx.runMutation(api.jobs.updateJobStatus, {
      jobId,
      status: 'researching',
    })

    const locationStr = location ? ` in ${location}` : ''
    const searchQuery = `${category} services${locationStr} contact email request quote`

    let vendors: Vendor[] = []

    try {
      const searchResults = await getFirecrawl().search(searchQuery, {
        limit: targetCount + 5,
      })
      const searchRecord = searchResults as Record<string, unknown>
      const rawList: Array<Record<string, unknown>> = Array.isArray(
        searchRecord.web,
      )
        ? (searchRecord.web as Array<Record<string, unknown>>)
        : Array.isArray(searchResults)
          ? searchResults
          : Array.isArray(searchRecord.data)
            ? (searchRecord.data as Array<Record<string, unknown>>)
            : []

      const resultsText = rawList
        .slice(0, 8)
        .map(
          (r: Record<string, unknown>) =>
            `URL: ${r.url ?? ''}\nTitle: ${r.title ?? ''}\nDescription: ${r.description ?? ''}\nContent: ${String(r.markdown ?? r.content ?? '').slice(0, 400)}`,
        )
        .join('\n---\n')

      if (resultsText.trim().length > 0) {
        const { text } = await generateText({
          model: getGeminiModel(),
          prompt: `Extract candidate real vendors from these web search results for ${category}${locationStr}.
Extract only genuine businesses matching the service request.
For the email, extract the actual email if visible, or derive the official contact address from their verified website domain (e.g. contact@domain.com or info@domain.com only if the domain is present in their URL). Do not fabricate non-existent companies.
Return ONLY a valid JSON array of objects without markdown formatting:
[
  {
    "name": "Vendor Name",
    "url": "https://...",
    "description": "Short description",
    "email": "contact email or null",
    "phone": "phone or null"
  }
]
Limit to at most ${targetCount} items.

Search results:
${resultsText}`,
        })

        const clean = text
          .replace(/^```json/i, '')
          .replace(/^```/i, '')
          .replace(/```$/i, '')
          .trim()
        const parsedVendors = JSON.parse(clean)
        if (Array.isArray(parsedVendors) && parsedVendors.length > 0) {
          vendors = parsedVendors
            .filter(
              (v: Record<string, unknown>) =>
                v && typeof v.name === 'string' && v.name.trim().length > 0,
            )
            .map((v: Record<string, unknown>) => {
              let email =
                typeof v.email === 'string' && v.email.includes('@')
                  ? v.email.trim()
                  : undefined
              if (!email && typeof v.url === 'string') {
                try {
                  const host = new URL(v.url).hostname.replace(/^www\./, '')
                  if (host && host.includes('.')) {
                    email = `contact@${host}`
                  }
                } catch {}
              }
              return {
                name: String(v.name).trim(),
                url: typeof v.url === 'string' ? v.url.trim() : undefined,
                description:
                  typeof v.description === 'string'
                    ? v.description.trim()
                    : undefined,
                email,
                phone: typeof v.phone === 'string' ? v.phone.trim() : undefined,
              }
            })
        }
      }
    } catch (err) {
      console.error('Firecrawl vendor research error:', err)
      vendors = []
    }

    if (vendors.length === 0) {
      await ctx.runMutation(api.jobs.updateJobStatus, {
        jobId,
        status: 'failed',
      })
    }

    await ctx.runMutation(api.jobs.updateJobVendors, { jobId, vendors })
    return { vendors }
  },
})

export const sendOutreach = action({
  args: {
    jobId: v.id('jobs'),
    agentEmail: v.string(),
    agentInboxId: v.string(),
    vendors: v.array(
      v.object({
        name: v.string(),
        url: v.optional(v.string()),
        description: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
    ),
    jobDescription: v.string(),
    budget: v.optional(v.string()),
    deadline: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (
    ctx,
    {
      jobId,
      agentEmail,
      agentInboxId,
      vendors,
      jobDescription,
      budget,
      deadline,
      userEmail,
    },
  ) => {
    if (!vendors || vendors.length === 0) {
      await ctx.runMutation(api.jobs.updateJobStatus, {
        jobId,
        status: 'failed',
      })
      return
    }

    await ctx.runMutation(api.jobs.updateJobStatus, {
      jobId,
      status: 'outreaching',
    })

    let sentCount = 0
    for (const vendor of vendors) {
      const vendorEmail =
        process.env.VENDOR_TEST_EMAIL || 'contigenhq@gmail.com'
      if (!vendorEmail || !vendorEmail.includes('@')) {
        continue
      }

      const threadId = await ctx.runMutation(api.threads.createThread, {
        jobId,
        vendorName: vendor.name,
        vendorEmail,
        vendorUrl: vendor.url,
        agentInboxId,
        agentEmail,
      })

      let subject = `Request for quote: ${jobDescription}`
      let body = `Hi ${vendor.name} team,\n\nWe are looking for ${jobDescription}.\n${budget ? `Budget: ${budget}\n` : ''}${deadline ? `Timeline: ${deadline}\n` : ''}\nPlease reply with your availability and pricing.\n\nBest regards,\nRelay Sourcing Team`

      try {
        const { text } = await generateText({
          model: getGeminiModel(),
          prompt: `Write a concise outreach inquiry email to ${vendor.name} requesting a quote.
Task: ${jobDescription}
Budget: ${budget ?? 'Standard market rates'}
Deadline: ${deadline ?? 'Soon'}
Client Contact: ${userEmail}

CRITICAL RULES:
- Never include bracketed placeholders like [Your Name], [Your Phone Number], [Company Name], etc.
- Sign off cleanly and directly as:
Best regards,
Relay Sourcing Team

Return ONLY valid JSON without markdown:
{
  "subject": "Request for Quote: ...",
  "body": "Hi ${vendor.name} team,\\n\\n..."
}`,
        })
        const clean = text
          .replace(/^```json/i, '')
          .replace(/^```/i, '')
          .replace(/```$/i, '')
          .trim()
        const parsedDraft = JSON.parse(clean)
        if (parsedDraft.subject) subject = String(parsedDraft.subject).trim()
        if (parsedDraft.body) {
          body = sanitizeEmailBody(String(parsedDraft.body))
        }
      } catch {
        subject = `Request for quote: ${jobDescription}`
      }

      await safeSend(agentInboxId, {
        to: [vendorEmail],
        subject,
        text: body,
      })

      await ctx.runMutation(api.threads.addMessage, {
        threadId,
        jobId,
        direction: 'outbound',
        subject,
        body,
      })

      await ctx.runMutation(api.threads.updateThreadStatus, {
        threadId,
        status: 'sent',
      })
      sentCount++
    }

    if (sentCount === 0) {
      await ctx.runMutation(api.jobs.updateJobStatus, {
        jobId,
        status: 'failed',
      })
      return
    }

    await ctx.runMutation(api.jobs.updateJobStatus, {
      jobId,
      status: 'awaiting_replies',
    })

    const userSubject = `Relay: We reached out to ${sentCount} vendors`
    const userText = `We have sent inquiries to ${vendors.map(v => v.name).join(', ')} regarding: "${jobDescription}".\n\nWe will analyze all replies and compile quotes.`
    const userHtml = renderOutreachEmail({
      jobId,
      dashboardUrl: getDashboardUrl(jobId),
      jobDescription,
      vendorNames: vendors.map(v => v.name),
    })

    await safeSend(agentInboxId, {
      to: [userEmail],
      subject: userSubject,
      text: userText,
      html: userHtml,
    })
  },
})

export const processReply = action({
  args: {
    jobId: v.id('jobs'),
    threadId: v.id('threads'),
    replyBody: v.string(),
    vendorName: v.string(),
    agentInboxId: v.string(),
    agentEmail: v.string(),
    vendorEmail: v.string(),
    jobDescription: v.string(),
    userEmail: v.string(),
    agentMailMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      jobId,
      threadId,
      replyBody,
      vendorName,
      agentInboxId,
      vendorEmail,
      jobDescription,
      userEmail,
      agentMailMessageId,
    } = args

    if (agentMailMessageId) {
      const existingThreadMsgs = await ctx.runQuery(
        api.threads.getMessagesByThread,
        { threadId },
      )
      if (
        existingThreadMsgs.some(
          m => m.agentMailMessageId === agentMailMessageId,
        )
      ) {
        return { status: 'already_processed' }
      }
    }

    await ctx.runMutation(api.threads.addMessage, {
      threadId,
      jobId,
      direction: 'inbound',
      subject: `Reply from ${vendorName}`,
      body: replyBody,
      agentMailMessageId,
    })

    await ctx.runMutation(api.threads.updateThreadStatus, {
      threadId,
      status: 'replied',
    })

    type AnalysisResult = {
      hasQuote?: boolean
      quoteAmount?: string | null
      action?: 'mark_complete' | 'ask_followup' | 'mark_declined'
      followupQuestion?: string | null
      summary?: string
    }

    let analyzed: AnalysisResult
    try {
      const { text } = await generateText({
        model: getGeminiModel(),
        prompt: `Analyze this vendor reply email for task: "${jobDescription}".
Vendor: ${vendorName}
Reply text:
${replyBody}

Return ONLY valid JSON without markdown:
{
  "hasQuote": boolean,
  "quoteAmount": "$amount or concise quote summary or null",
  "action": "mark_complete" | "ask_followup" | "mark_declined",
  "followupQuestion": "clarifying question if needed, else null",
  "summary": "one-sentence recap of what the vendor offered"
}`,
      })

      const clean = text
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim()
      analyzed = JSON.parse(clean)
    } catch {
      const match = replyBody.match(/\$[\d,]+(\.\d+)?/)
      analyzed = {
        hasQuote: Boolean(match),
        quoteAmount: match ? match[0] : null,
        action: match ? 'mark_complete' : 'ask_followup',
        followupQuestion: match
          ? null
          : 'Could you provide full pricing and availability details?',
        summary: replyBody.slice(0, 100),
      }
    }

    const isAutoReply = (text: string) => {
      const lower = text.toLowerCase()
      return (
        lower.includes('thank you for emailing') ||
        lower.includes('thank you for contacting') ||
        lower.includes('auto-reply') ||
        lower.includes('autoreply') ||
        lower.includes('automatic reply') ||
        lower.includes('out of office') ||
        lower.includes('mailer-daemon') ||
        lower.includes('undelivered') ||
        lower.includes('confidential and proprietary')
      )
    }

    if (isAutoReply(replyBody)) {
      return { status: 'auto_reply_ignored' }
    }

    const threadMsgs = await ctx.runQuery(api.threads.getMessagesByThread, {
      threadId,
    })
    const outboundCount = threadMsgs.filter(
      m => m.direction === 'outbound',
    ).length
    if (outboundCount >= 2 && analyzed.action === 'ask_followup') {
      analyzed.action = 'mark_complete'
      analyzed.followupQuestion = null
    }

    if (analyzed.hasQuote && analyzed.quoteAmount) {
      await ctx.runMutation(api.threads.updateThreadStatus, {
        threadId,
        status: 'quote_received',
        quote: analyzed.quoteAmount,
        notes: analyzed.summary,
      })
    } else if (analyzed.action === 'mark_declined') {
      await ctx.runMutation(api.threads.updateThreadStatus, {
        threadId,
        status: 'declined',
        notes: analyzed.summary,
      })
    } else if (
      analyzed.action === 'ask_followup' &&
      analyzed.followupQuestion
    ) {
      let fs = 'Follow-up regarding quote'
      let fb = analyzed.followupQuestion

      try {
        const { text } = await generateText({
          model: getGeminiModel(),
          prompt: `Draft a quick professional follow-up email to ${vendorName}.
Question to ask: ${analyzed.followupQuestion}
Context: ${jobDescription}

CRITICAL RULES:
- Never include bracketed placeholders like [Your Name], [Your Phone Number], etc.
- Sign off cleanly and directly as:
Best regards,
Relay Sourcing Team

Return ONLY valid JSON without markdown:
{
  "subject": "Follow-up: ...",
  "body": "Hi ${vendorName},\\n\\n..."
}`,
        })
        const clean = text
          .replace(/^```json/i, '')
          .replace(/^```/i, '')
          .replace(/```$/i, '')
          .trim()
        const draft = JSON.parse(clean)
        if (draft.subject) fs = String(draft.subject).trim()
        if (draft.body) fb = sanitizeEmailBody(String(draft.body))
      } catch {
        fs = 'Follow-up regarding your quote'
      }

      const targetVendorEmail =
        process.env.VENDOR_TEST_EMAIL || 'contigenhq@gmail.com' || vendorEmail

      await safeSend(agentInboxId, {
        to: [targetVendorEmail],
        subject: fs,
        text: fb,
      })

      await ctx.runMutation(api.threads.addMessage, {
        threadId,
        jobId,
        direction: 'outbound',
        subject: fs,
        body: fb,
      })

      await ctx.runMutation(api.threads.updateThreadStatus, {
        threadId,
        status: 'following_up',
      })
    }

    const statusHeadline =
      analyzed.hasQuote && analyzed.quoteAmount
        ? `Quote Received: ${analyzed.quoteAmount}`
        : analyzed.action === 'mark_declined'
          ? 'Vendor Declined'
          : 'Follow-up Sent'

    const userEmailSubject = `Relay: Response from ${vendorName} (${statusHeadline})`
    const userEmailBody = `Hello,

We received a response from ${vendorName} regarding your request: "${jobDescription}".

Status: ${statusHeadline}
Vendor Notes: ${analyzed.summary || 'Vendor replied to our inquiry.'}
${analyzed.quoteAmount ? `Quote: ${analyzed.quoteAmount}\n` : ''}${analyzed.action === 'ask_followup' && analyzed.followupQuestion ? `Relay Follow-up: We asked the vendor: "${analyzed.followupQuestion}"\n` : ''}
All activity has been updated on your Relay dashboard.

Best regards,
Relay Sourcing Team`

    const userEmailHtml = renderVendorReplyEmail({
      jobId,
      dashboardUrl: getDashboardUrl(jobId),
      jobDescription,
      vendorName,
      statusHeadline,
      summary: analyzed.summary || 'Vendor replied to our inquiry.',
      quoteAmount: analyzed.quoteAmount,
      followupQuestion:
        analyzed.action === 'ask_followup' ? analyzed.followupQuestion : null,
    })

    await safeSend(agentInboxId, {
      to: [userEmail],
      subject: userEmailSubject,
      text: userEmailBody,
      html: userEmailHtml,
    })

    const allThreads = await ctx.runQuery(api.threads.getThreadsByJob, {
      jobId,
    })
    const remainingPending = allThreads.filter(
      t =>
        t.status === 'pending' ||
        t.status === 'sent' ||
        t.status === 'replied' ||
        t.status === 'following_up',
    )
    const currentJob = await ctx.runQuery(api.jobs.getJob, { jobId })
    if (
      currentJob?.status !== 'completed' &&
      remainingPending.length === 0 &&
      allThreads.length > 0
    ) {
      await ctx.runAction(api.agent.compileSummary, {
        jobId,
        userEmail,
        jobDescription,
        agentInboxId,
      })
    }

    return { analyzed }
  },
})

export const compileSummary = action({
  args: {
    jobId: v.id('jobs'),
    userEmail: v.string(),
    jobDescription: v.string(),
    agentInboxId: v.string(),
  },
  handler: async (
    ctx,
    { jobId, userEmail, jobDescription, agentInboxId },
  ): Promise<{ summary: string }> => {
    await ctx.runMutation(api.jobs.updateJobStatus, {
      jobId,
      status: 'compiling',
    })

    type ThreadDoc = {
      _id: Id<'threads'>
      vendorName: string
      status: string
      quote?: string
      notes?: string
    }

    type SummaryItem = {
      vendor: string
      status: string
      quote: string
      notes: string
    }

    const threads = (await ctx.runQuery(api.threads.getThreadsByJob, {
      jobId,
    })) as ThreadDoc[]
    const summaryInput: SummaryItem[] = threads.map((t: ThreadDoc) => ({
      vendor: t.vendorName,
      status: t.status,
      quote: t.quote ?? 'No quote received',
      notes: t.notes ?? '',
    }))

    const subject = `Relay: Sourcing report for ${jobDescription.slice(0, 40)}`

    let body = `Summary for: ${jobDescription}\n\nVendor Results:\n${summaryInput.map((s: SummaryItem) => `- ${s.vendor}: ${s.quote} (${s.status})${s.notes ? ` - ${s.notes}` : ''}`).join('\n')}\n\nAll tasks and quotes have been compiled by Relay.`

    try {
      const { text } = await generateText({
        model: getGeminiModel(),
        prompt: `Write a clear final executive summary email for this sourcing job.
Task: ${jobDescription}
Vendor results:
${JSON.stringify(summaryInput, null, 2)}

Include:
1. Overview of vendors contacted
2. Comparative pricing table
3. Top recommendation and clear next steps`,
      })
      body = text
    } catch {}

    const summaryHtml = renderExecutiveSummaryEmail({
      jobId,
      dashboardUrl: getDashboardUrl(jobId),
      jobDescription,
      summaryText: body,
    })

    await safeSend(agentInboxId, {
      to: [userEmail],
      subject,
      text: body,
      html: summaryHtml,
    })

    await ctx.runMutation(api.jobs.updateJobSummary, { jobId, summary: body })
    return { summary: body }
  },
})

export const requestDecision = action({
  args: {
    jobId: v.id('jobs'),
    threadId: v.optional(v.id('threads')),
    question: v.string(),
    context: v.string(),
    options: v.optional(v.array(v.string())),
    userEmail: v.string(),
    agentInboxId: v.string(),
  },
  handler: async (
    ctx,
    { jobId, threadId, question, context, options, userEmail, agentInboxId },
  ): Promise<{ decisionId: Id<'decisions'> }> => {
    const decisionId: Id<'decisions'> = await ctx.runMutation(
      api.decisions.createDecision,
      {
        jobId,
        threadId,
        question,
        context,
        options: options ?? [],
      },
    )

    const decisionText = `Relay needs a decision to continue your sourcing job:\n\n"${question}"\n\nContext: ${context}\n${options ? `Options:\n${options.map(o => `• ${o}`).join('\n')}\n` : ''}\nReply directly to this email or resolve on your dashboard.`
    const decisionHtml = renderDecisionRequiredEmail({
      jobId,
      dashboardUrl: getDashboardUrl(jobId),
      jobDescription: context,
      question,
      context,
      options: options ?? [],
    })

    await safeSend(agentInboxId, {
      to: [userEmail],
      subject: `[Action Required] Relay needs your input`,
      text: decisionText,
      html: decisionHtml,
    })

    await ctx.runMutation(api.jobs.updateJobStatus, {
      jobId,
      status: 'needs_decision',
    })
    return { decisionId }
  },
})

export const startPipeline = action({
  args: {
    userEmail: v.string(),
    rawTask: v.string(),
    sourceMessageId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { userEmail, rawTask, sourceMessageId },
  ): Promise<{ jobId: Id<'jobs'> }> => {
    const jobId: Id<'jobs'> = await ctx.runMutation(api.jobs.createJob, {
      userEmail,
      rawTask,
      sourceMessageId,
    })

    const {
      parsed,
      agentInboxId,
      agentEmail,
    }: { parsed: ParsedIntent; agentInboxId: string; agentEmail: string } =
      await ctx.runAction(api.agent.parseTask, {
        jobId,
        rawTask,
        userEmail,
      })

    const userAckHtml = renderAcknowledgmentEmail({
      jobId,
      dashboardUrl: getDashboardUrl(jobId),
      taskDescription: parsed.description ?? rawTask,
    })

    await safeSend(agentInboxId, {
      to: [userEmail],
      subject: 'Relay: Sourcing request received',
      text: `Hi,\n\nWe received your sourcing request: "${rawTask}".\n\nRelay is currently analyzing requirements, discovering verified vendors, and dispatching inquiries.\n\nTrack real-time progress on your dashboard: ${getDashboardUrl(jobId)}\n\nBest regards,\nRelay Sourcing Team`,
      html: userAckHtml,
    })

    const { vendors }: { vendors: Vendor[] } = await ctx.runAction(
      api.agent.researchVendors,
      {
        jobId,
        category: parsed.category ?? parsed.taskType ?? 'services',
        location: parsed.location,
        targetCount: parsed.targetCount ?? 3,
      },
    )

    try {
      await ctx.runAction(api.agent.sendOutreach, {
        jobId,
        agentEmail,
        agentInboxId,
        vendors,
        jobDescription: parsed.description ?? rawTask,
        budget: parsed.budget,
        deadline: parsed.deadline,
        userEmail,
      })
    } catch (err) {
      console.error('sendOutreach failed:', err)
      await ctx.runMutation(api.jobs.updateJobStatus, {
        jobId,
        status: 'failed',
      })
      throw err
    }

    return { jobId }
  },
})

export const syncInboxMessages = action({
  args: { jobId: v.optional(v.id('jobs')) },
  handler: async (ctx, { jobId }) => {
    let targetJob = null
    if (jobId) {
      targetJob = await ctx.runQuery(api.jobs.getJob, { jobId })
    } else {
      const jobs = await ctx.runQuery(api.jobs.listJobs, {})
      targetJob =
        jobs.find(
          j =>
            j.status === 'awaiting_replies' ||
            j.status === 'needs_decision' ||
            j.status === 'outreaching',
        ) ?? jobs[0]
    }

    if (!targetJob || !targetJob.agentInboxId) {
      return { synced: 0, reason: 'no_job_or_inbox' }
    }

    await ensureWebhookRegistered()

    const client = getAgentMail()
    let messagesResponse
    try {
      messagesResponse = await client.inboxes.messages.list(
        targetJob.agentInboxId,
      )
    } catch (err) {
      console.error('Failed to list messages from AgentMail:', err)
      return { synced: 0, error: String(err) }
    }

    const messages = messagesResponse.messages ?? []
    if (messages.length === 0) {
      return { synced: 0 }
    }

    const existingMessages = await ctx.runQuery(api.threads.getMessagesByJob, {
      jobId: targetJob._id,
    })
    const knownMessageIds = new Set(
      existingMessages
        .map(m => m.agentMailMessageId)
        .filter((id): id is string => Boolean(id)),
    )

    const threads = await ctx.runQuery(api.threads.getThreadsByJob, {
      jobId: targetJob._id,
    })

    let syncedCount = 0
    for (const msg of messages) {
      if (msg.messageId && knownMessageIds.has(msg.messageId)) {
        continue
      }
      if (msg.messageId) {
        knownMessageIds.add(msg.messageId)
      }

      const rawFrom = String(msg.from || '')
      const senderEmail = extractEmail(rawFrom)

      if (
        targetJob.agentEmail &&
        senderEmail === extractEmail(targetJob.agentEmail)
      ) {
        continue
      }

      let rawBody = String(msg.preview || '').trim()
      try {
        const fullMsg = await client.inboxes.messages.get(
          targetJob.agentInboxId,
          msg.messageId,
        )
        rawBody = String(
          fullMsg.text || fullMsg.extractedText || fullMsg.preview || rawBody,
        ).trim()
      } catch {}

      if (!rawBody) {
        continue
      }

      const matchingThread = threads.find(t => {
        const ve = t.vendorEmail.toLowerCase().trim()
        return (
          senderEmail === ve ||
          senderEmail.includes(ve) ||
          ve.includes(senderEmail) ||
          rawFrom.toLowerCase().includes(ve) ||
          (t.vendorName &&
            rawFrom.toLowerCase().includes(t.vendorName.toLowerCase()))
        )
      })

      if (matchingThread) {
        await ctx.runAction(api.agent.processReply, {
          jobId: targetJob._id,
          threadId: matchingThread._id,
          replyBody: rawBody,
          vendorName: matchingThread.vendorName,
          agentInboxId: targetJob.agentInboxId,
          agentEmail: targetJob.agentEmail || '',
          vendorEmail: matchingThread.vendorEmail,
          jobDescription:
            targetJob.parsedIntent?.description ?? targetJob.rawTask,
          userEmail: targetJob.userEmail,
          agentMailMessageId: msg.messageId,
        })
        syncedCount++
      } else if (senderEmail === extractEmail(targetJob.userEmail)) {
        const pending = await ctx.runQuery(api.decisions.getPendingDecision, {
          jobId: targetJob._id,
        })
        if (pending) {
          await ctx.runMutation(api.decisions.resolveDecision, {
            decisionId: pending._id,
            userReply: rawBody,
          })
          await ctx.runAction(api.agent.compileSummary, {
            jobId: targetJob._id,
            userEmail: targetJob.userEmail,
            jobDescription:
              targetJob.parsedIntent?.description ?? targetJob.rawTask,
            agentInboxId: targetJob.agentInboxId,
          })
          syncedCount++
        }
      }
    }

    return { synced: syncedCount, totalFetched: messages.length }
  },
})

export const syncPrimaryInbound = action({
  args: {},
  handler: async ctx => {
    await ensureWebhookRegistered()

    const client = getAgentMail()
    let inboxesList
    try {
      inboxesList = await client.inboxes.list()
    } catch (err) {
      console.error('Failed to list inboxes:', err)
      return { synced: 0 }
    }

    const primaryInbox = inboxesList.inboxes?.[0]
    if (!primaryInbox) return { synced: 0 }

    let messagesResponse
    try {
      messagesResponse = await client.inboxes.messages.list(
        primaryInbox.inboxId,
      )
    } catch (err) {
      console.error('Failed to list messages from primary inbox:', err)
      return { synced: 0 }
    }

    const messages = messagesResponse.messages ?? []
    if (messages.length === 0) return { synced: 0 }

    const jobs = await ctx.runQuery(api.jobs.listJobs, {})
    const processedSourceIds = new Set(
      jobs
        .map(j => (j as { sourceMessageId?: string }).sourceMessageId)
        .filter((id): id is string => Boolean(id)),
    )

    let createdCount = 0
    for (const msg of messages) {
      if (msg.messageId && processedSourceIds.has(msg.messageId)) {
        continue
      }

      const rawFrom = String(msg.from || '')
      const senderEmail = extractEmail(rawFrom)
      if (!senderEmail || senderEmail.includes('agentmail.to')) {
        continue
      }

      let rawBody = String(msg.preview || '').trim()
      let subject = String(msg.subject || '').trim()
      try {
        const fullMsg = await client.inboxes.messages.get(
          primaryInbox.inboxId,
          msg.messageId,
        )
        rawBody = String(
          fullMsg.text || fullMsg.extractedText || fullMsg.preview || rawBody,
        ).trim()
        if (fullMsg.subject) subject = String(fullMsg.subject).trim()
      } catch {}

      if (!rawBody && !subject) continue

      const lower = `${subject} ${rawBody}`.toLowerCase()
      if (
        lower.includes('automatic reply') ||
        lower.includes('auto-reply') ||
        lower.includes('autoreply') ||
        lower.includes('out of office') ||
        lower.includes('mailer-daemon') ||
        lower.includes('undelivered')
      ) {
        if (msg.messageId) processedSourceIds.add(msg.messageId)
        continue
      }

      const fullTask = subject ? `${subject}\n\n${rawBody}` : rawBody

      const alreadyExists = jobs.some(
        j =>
          (msg.messageId &&
            (j as { sourceMessageId?: string }).sourceMessageId ===
              msg.messageId) ||
          (j.userEmail === senderEmail &&
            Date.now() - j.createdAt < 600000 &&
            j.rawTask === fullTask),
      )

      if (!alreadyExists) {
        try {
          await ctx.runAction(api.agent.startPipeline, {
            userEmail: senderEmail,
            rawTask: fullTask,
            sourceMessageId: msg.messageId,
          })
          if (msg.messageId) processedSourceIds.add(msg.messageId)
          createdCount++
        } catch (err) {
          console.error('Failed to start pipeline for inbound message:', err)
        }
      }
    }

    return { created: createdCount, totalFetched: messages.length }
  },
})

export const syncAllActiveInboxes = internalAction({
  args: {},
  handler: async ctx => {
    try {
      await ctx.runAction(api.agent.syncPrimaryInbound, {})
    } catch (err) {
      console.error('Failed to sync primary inbound:', err)
    }

    const jobs = await ctx.runQuery(api.jobs.listJobs, {})
    const activeJobs = jobs.filter(
      j => j.status === 'awaiting_replies' || j.status === 'needs_decision',
    )
    for (const job of activeJobs) {
      if (job.agentInboxId) {
        try {
          await ctx.runAction(api.agent.syncInboxMessages, { jobId: job._id })
        } catch (err) {
          console.error(`Cron sync failed for job ${job._id}:`, err)
        }
      }
    }
  },
})
