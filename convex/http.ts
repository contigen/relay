import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api, components } from './_generated/api'
import { registerStaticRoutes } from '@convex-dev/static-hosting'

const http = httpRouter()

const extractEmail = (fromStr: string): string => {
  if (!fromStr) return ''
  const match = fromStr.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  return fromStr.trim().toLowerCase()
}

http.route({
  path: '/webhook/agentmail',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const raw = (await request.json()) as Record<string, unknown>
    const messageObj = (raw.message ??
      (raw.data as Record<string, unknown> | undefined)?.message ??
      raw) as Record<string, unknown>

    const inboxId = String(
      messageObj.inboxId ??
        messageObj.inbox_id ??
        raw.inboxId ??
        raw.inbox_id ??
        (raw.data as Record<string, unknown> | undefined)?.inbox_id ??
        '',
    ).trim()

    const rawFrom = String(
      (messageObj.from as { email?: string } | undefined)?.email ??
        messageObj.from ??
        (raw.from as { email?: string } | undefined)?.email ??
        raw.from ??
        '',
    ).trim()

    const fromEmail = extractEmail(rawFrom)

    const messageBody = String(
      messageObj.text ??
        messageObj.extractedText ??
        messageObj.body ??
        messageObj.content ??
        raw.text ??
        raw.body ??
        raw.content ??
        '',
    ).trim()

    const agentMailMessageId = messageObj.messageId
      ? String(messageObj.messageId)
      : undefined

    if (!messageBody) {
      return new Response('Missing required message content', { status: 400 })
    }

    const toAddresses: string[] = Array.isArray(messageObj.to)
      ? messageObj.to.map((t: unknown) => extractEmail(String(t)))
      : []

    if (!fromEmail || fromEmail.includes('agentmail.to')) {
      return new Response('OK', { status: 200 })
    }

    const jobs = await ctx.runQuery(api.jobs.listJobs, {})

    let matchingThread = null
    let matchingJob = null

    for (const j of jobs) {
      if (j.status === 'completed' || j.status === 'failed') continue
      const threads = await ctx.runQuery(api.threads.getThreadsByJob, {
        jobId: j._id,
      })
      const thread = threads.find(t => {
        const ve = t.vendorEmail.toLowerCase().trim()
        return (
          ve === fromEmail ||
          fromEmail.includes(ve) ||
          ve.includes(fromEmail) ||
          rawFrom.toLowerCase().includes(ve) ||
          (t.vendorName &&
            rawFrom.toLowerCase().includes(t.vendorName.toLowerCase()))
        )
      })
      if (thread) {
        matchingThread = thread
        matchingJob = j
        break
      }
    }

    if (matchingThread && matchingJob) {
      await ctx.runAction(api.agent.processReply, {
        jobId: matchingJob._id,
        threadId: matchingThread._id,
        replyBody: messageBody,
        vendorName: matchingThread.vendorName,
        agentInboxId: matchingJob.agentInboxId!,
        agentEmail: matchingJob.agentEmail!,
        vendorEmail: matchingThread.vendorEmail,
        jobDescription:
          matchingJob.parsedIntent?.description ?? matchingJob.rawTask,
        userEmail: matchingJob.userEmail,
        agentMailMessageId,
      })
      return new Response('OK', { status: 200 })
    }

    const decisionJob = jobs.find(
      j =>
        extractEmail(j.userEmail) === fromEmail &&
        j.status === 'needs_decision',
    )
    if (decisionJob) {
      const pending = await ctx.runQuery(api.decisions.getPendingDecision, {
        jobId: decisionJob._id,
      })
      if (pending) {
        await ctx.runMutation(api.decisions.resolveDecision, {
          decisionId: pending._id,
          userReply: messageBody,
        })
        await ctx.runAction(api.agent.compileSummary, {
          jobId: decisionJob._id,
          userEmail: decisionJob.userEmail,
          jobDescription:
            decisionJob.parsedIntent?.description ?? decisionJob.rawTask,
          agentInboxId: decisionJob.agentInboxId!,
        })
        return new Response('OK', { status: 200 })
      }
    }

    const rawSubject = String(messageObj.subject ?? raw.subject ?? '').trim()
    const fullTask = rawSubject
      ? `${rawSubject}\n\n${messageBody}`
      : messageBody

    const lower = `${rawSubject} ${messageBody}`.toLowerCase()
    if (
      lower.includes('automatic reply') ||
      lower.includes('auto-reply') ||
      lower.includes('autoreply') ||
      lower.includes('out of office') ||
      lower.includes('mailer-daemon') ||
      lower.includes('undelivered')
    ) {
      return new Response('OK', { status: 200 })
    }

    const alreadyCreated = jobs.some(
      j =>
        (agentMailMessageId &&
          (j as { sourceMessageId?: string }).sourceMessageId ===
            agentMailMessageId) ||
        (j.userEmail === fromEmail &&
          Date.now() - j.createdAt < 300000 &&
          j.rawTask === fullTask),
    )

    if (!alreadyCreated) {
      await ctx.runAction(api.agent.startPipeline, {
        userEmail: fromEmail,
        rawTask: fullTask,
        sourceMessageId: agentMailMessageId,
      })
    }

    return new Response('OK', { status: 200 })
  }),
})

http.route({
  path: '/inbound',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()

    const userEmail: string = body.from?.email ?? body.from ?? ''
    const rawTask: string = body.text ?? body.body ?? body.content ?? ''

    if (!userEmail || !rawTask) {
      return new Response('Missing fields', { status: 400 })
    }

    const jobId = await ctx.runMutation(api.jobs.createJob, {
      userEmail,
      rawTask,
    })

    await ctx.runAction(api.agent.parseTask, { jobId, rawTask, userEmail })

    const job = await ctx.runQuery(api.jobs.getJob, { jobId })
    if (job?.parsedIntent && job.agentInboxId && job.agentEmail) {
      await ctx.runAction(api.agent.researchVendors, {
        jobId,
        category: job.parsedIntent.category ?? job.parsedIntent.taskType,
        location: job.parsedIntent.location,
        targetCount: job.parsedIntent.targetCount ?? 3,
      })

      const updatedJob = await ctx.runQuery(api.jobs.getJob, { jobId })
      if (updatedJob?.firecrawlResults) {
        await ctx.runAction(api.agent.sendOutreach, {
          jobId,
          agentEmail: job.agentEmail,
          agentInboxId: job.agentInboxId,
          vendors: updatedJob.firecrawlResults,
          jobDescription: job.parsedIntent.description,
          budget: job.parsedIntent.budget,
          deadline: job.parsedIntent.deadline,
          userEmail,
        })
      }
    }

    return new Response(JSON.stringify({ jobId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
})

http.route({
  pathPrefix: '/job/',
  method: 'GET',
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url)
    const segments = url.pathname.split('/').filter(Boolean)
    const jobId = segments[1]
    const dest = jobId
      ? `${url.origin}/jobs?job=${encodeURIComponent(jobId)}`
      : `${url.origin}/jobs`
    return Response.redirect(dest, 302)
  }),
})

http.route({
  path: '/job',
  method: 'GET',
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url)
    return Response.redirect(`${url.origin}/jobs${url.search}`, 302)
  }),
})

http.route({
  path: '/jobs',
  method: 'GET',
  handler: httpAction(async (ctx, _request) => {
    const asset = await ctx.runQuery(
      components.staticHosting.lib.resolveAssetForHttp,
      { path: '/jobs.html' },
    )
    if (!asset || !asset.storageUrl) {
      return new Response('Not Found', { status: 404 })
    }
    const res = await fetch(asset.storageUrl)
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    })
  }),
})

http.route({
  path: '/jobs/',
  method: 'GET',
  handler: httpAction(async (ctx, _request) => {
    const asset = await ctx.runQuery(
      components.staticHosting.lib.resolveAssetForHttp,
      { path: '/jobs.html' },
    )
    if (!asset || !asset.storageUrl) {
      return new Response('Not Found', { status: 404 })
    }
    const res = await fetch(asset.storageUrl)
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    })
  }),
})

registerStaticRoutes(http, components.staticHosting)

export default http
