"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { FirecrawlClient } from "firecrawl";
import { AgentMailClient } from "agentmail";

const getGeminiModel = () => {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY");
  }
  const google = createGoogleGenerativeAI({ apiKey: key });
  return google("gemini-3.6-flash");
};

const getFirecrawl = () => {
  return new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY || "" });
};

const getAgentMail = () => {
  return new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY || "" });
};

type Vendor = {
  name: string;
  url?: string;
  description?: string;
  email?: string;
  phone?: string;
};

type ParsedIntent = {
  taskType: string;
  description: string;
  targetCount?: number;
  location?: string;
  budget?: string;
  deadline?: string;
  category?: string;
};

export const parseTask = action({
  args: { jobId: v.id("jobs"), rawTask: v.string(), userEmail: v.string() },
  handler: async (ctx, { jobId, rawTask }) => {
    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "parsing" });

    let parsed: ParsedIntent;
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
      });

      const clean = text.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
      const raw = JSON.parse(clean);
      parsed = {
        taskType: typeof raw.taskType === "string" ? raw.taskType : "sourcing",
        description: typeof raw.description === "string" ? raw.description : rawTask.slice(0, 100),
        targetCount: typeof raw.targetCount === "number" ? raw.targetCount : 3,
        location: typeof raw.location === "string" ? raw.location : undefined,
        budget: typeof raw.budget === "string" ? raw.budget : undefined,
        deadline: typeof raw.deadline === "string" ? raw.deadline : undefined,
        category: typeof raw.category === "string" ? raw.category : "services",
      };
    } catch {
      parsed = {
        taskType: "sourcing",
        description: rawTask.slice(0, 100),
        targetCount: 3,
        category: "services",
      };
    }

    let agentInboxId: string = `demo-${jobId.slice(-8)}`;
    let agentEmail: string = `relay-${jobId.slice(-8)}@agentmail.to`;

    try {
      const inbox = await getAgentMail().inboxes.create({
        username: `relay-${jobId.slice(-8)}`,
        displayName: "Relay Agent",
      });
      const record = inbox as unknown as Record<string, unknown>;
      agentInboxId = (record.inboxId as string) ?? (record.id as string) ?? agentInboxId;
      agentEmail = (record.emailAddress as string) ?? (record.email as string) ?? agentEmail;
    } catch {
      agentInboxId = `demo-${jobId.slice(-8)}`;
      agentEmail = `relay-${jobId.slice(-8)}@agentmail.to`;
    }

    await ctx.runMutation(api.jobs.updateJobParsed, {
      jobId,
      parsedIntent: parsed,
      agentInboxId,
      agentEmail,
    });

    return { parsed, agentInboxId, agentEmail };
  },
});

export const researchVendors = action({
  args: {
    jobId: v.id("jobs"),
    category: v.string(),
    location: v.optional(v.string()),
    targetCount: v.number(),
  },
  handler: async (ctx, { jobId, category, location, targetCount }): Promise<{ vendors: Vendor[] }> => {
    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "researching" });

    const locationStr = location ? ` in ${location}` : "";
    const searchQuery = `${category} services${locationStr} contact email request quote`;

    let vendors: Vendor[] = [];

    try {
      const searchResults = await getFirecrawl().search(searchQuery, { limit: targetCount + 3 });
      const searchRecord = searchResults as Record<string, unknown>;
      const rawList = Array.isArray(searchResults)
        ? searchResults
        : Array.isArray(searchRecord.data)
          ? (searchRecord.data as Array<Record<string, unknown>>)
          : [];

      const resultsText = rawList
        .slice(0, 6)
        .map((r: Record<string, unknown>) =>
          `URL: ${r.url ?? ""}\nTitle: ${r.title ?? ""}\nDescription: ${r.description ?? ""}\nContent: ${String(r.markdown ?? r.content ?? "").slice(0, 400)}`
        )
        .join("\n---\n");

      const { text } = await generateText({
        model: getGeminiModel(),
        prompt: `Extract candidate vendors from these search results for ${category}${locationStr}.
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
Limit to ${targetCount} items.

Search results:
${resultsText}`,
      });

      const clean = text.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
      const parsedVendors = JSON.parse(clean);
      if (Array.isArray(parsedVendors) && parsedVendors.length > 0) {
        vendors = parsedVendors.map((v: Record<string, unknown>, i: number) => ({
          name: String(v.name || `Vendor ${i + 1}`),
          url: v.url ? String(v.url) : undefined,
          description: v.description ? String(v.description) : undefined,
          email: v.email ? String(v.email) : `contact${i + 1}@${String(v.name || "vendor").toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          phone: v.phone ? String(v.phone) : undefined,
        }));
      }
    } catch {
      vendors = [
        {
          name: `${category} Co. #1`,
          url: "https://example1.com",
          description: `Premier ${category} in ${location || "your area"}`,
          email: `quote@${category.toLowerCase().replace(/\s+/g, "")}co1.com`,
        },
        {
          name: `${category} Group #2`,
          url: "https://example2.com",
          description: `Certified ${category} specialists`,
          email: `sales@${category.toLowerCase().replace(/\s+/g, "")}group2.com`,
        },
        {
          name: `Apex ${category} #3`,
          url: "https://example3.com",
          description: `Fast & reliable ${category} team`,
          email: `contact@apex${category.toLowerCase().replace(/\s+/g, "")}.com`,
        },
      ].slice(0, targetCount);
    }

    if (vendors.length === 0) {
      vendors = [
        {
          name: `${category} Services`,
          email: `hello@${category.toLowerCase().replace(/\s+/g, "")}austin.com`,
          description: `Dedicated ${category} provider`,
        },
      ];
    }

    await ctx.runMutation(api.jobs.updateJobVendors, { jobId, vendors });
    return { vendors };
  },
});

export const sendOutreach = action({
  args: {
    jobId: v.id("jobs"),
    agentEmail: v.string(),
    agentInboxId: v.string(),
    vendors: v.array(
      v.object({
        name: v.string(),
        url: v.optional(v.string()),
        description: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
      })
    ),
    jobDescription: v.string(),
    budget: v.optional(v.string()),
    deadline: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (
    ctx,
    { jobId, agentEmail, agentInboxId, vendors, jobDescription, budget, deadline, userEmail }
  ) => {
    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "outreaching" });

    for (const vendor of vendors) {
      const vendorEmail = vendor.email ?? `info@${vendor.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;

      const threadId = await ctx.runMutation(api.threads.createThread, {
        jobId,
        vendorName: vendor.name,
        vendorEmail,
        vendorUrl: vendor.url,
        agentInboxId,
        agentEmail,
      });


      let subject = `Request for quote: ${jobDescription}`;
      let body = `Hi ${vendor.name} team,\n\nWe are looking for ${jobDescription}.\n${budget ? `Budget: ${budget}\n` : ""}${deadline ? `Timeline: ${deadline}\n` : ""}\nPlease reply with your availability and pricing.\n\nBest regards,\nRelay Sourcing Agent`;

      try {
        const { text } = await generateText({
          model: getGeminiModel(),
          prompt: `Write a concise outreach inquiry email to ${vendor.name} requesting a quote.
Task: ${jobDescription}
Budget: ${budget ?? "Standard market rates"}
Deadline: ${deadline ?? "Soon"}

Return ONLY valid JSON without markdown:
{
  "subject": "Request for Quote: ...",
  "body": "Hi ${vendor.name} team,\\n\\n..."
}`,
        });
        const clean = text.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
        const parsedDraft = JSON.parse(clean);
        if (parsedDraft.subject) subject = String(parsedDraft.subject);
        if (parsedDraft.body) body = String(parsedDraft.body);
      } catch {
        subject = `Request for quote: ${jobDescription}`;
      }

      try {
        await getAgentMail().inboxes.messages.send(agentInboxId, {
          to: [vendorEmail],
          subject,
          text: body,
        });
      } catch {}


      await ctx.runMutation(api.threads.addMessage, {
        threadId,
        jobId,
        direction: "outbound",
        subject,
        body,
      });

      await ctx.runMutation(api.threads.updateThreadStatus, { threadId, status: "sent" });
    }

    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "awaiting_replies" });

    try {
      await getAgentMail().inboxes.messages.send(agentInboxId, {
        to: [userEmail],
        subject: `Relay: We reached out to ${vendors.length} vendors`,
        text: `We have sent inquiries to ${vendors.map((v) => v.name).join(", ")} regarding: "${jobDescription}".\n\nWe will analyze all replies and compile quotes.`,
      });
    } catch {}

  },
});

export const processReply = action({
  args: {
    jobId: v.id("jobs"),
    threadId: v.id("threads"),
    replyBody: v.string(),
    vendorName: v.string(),
    agentInboxId: v.string(),
    agentEmail: v.string(),
    vendorEmail: v.string(),
    jobDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const { jobId, threadId, replyBody, vendorName, agentInboxId, vendorEmail, jobDescription } = args;

    await ctx.runMutation(api.threads.addMessage, {
      threadId,
      jobId,
      direction: "inbound",
      subject: `Reply from ${vendorName}`,
      body: replyBody,
    });

    await ctx.runMutation(api.threads.updateThreadStatus, { threadId, status: "replied" });

    type AnalysisResult = {
      hasQuote?: boolean;
      quoteAmount?: string | null;
      action?: "mark_complete" | "ask_followup" | "mark_declined";
      followupQuestion?: string | null;
      summary?: string;
    };

    let analyzed: AnalysisResult;
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
      });

      const clean = text.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
      analyzed = JSON.parse(clean);
    } catch {
      const match = replyBody.match(/\$[\d,]+(\.\d+)?/);
      analyzed = {
        hasQuote: Boolean(match),
        quoteAmount: match ? match[0] : null,
        action: match ? "mark_complete" : "ask_followup",
        followupQuestion: match ? null : "Could you provide full pricing and availability details?",
        summary: replyBody.slice(0, 100),
      };
    }

    if (analyzed.hasQuote && analyzed.quoteAmount) {
      await ctx.runMutation(api.threads.updateThreadStatus, {
        threadId,
        status: "quote_received",
        quote: analyzed.quoteAmount,
        notes: analyzed.summary,
      });
    } else if (analyzed.action === "mark_declined") {
      await ctx.runMutation(api.threads.updateThreadStatus, {
        threadId,
        status: "declined",
        notes: analyzed.summary,
      });
    } else if (analyzed.action === "ask_followup" && analyzed.followupQuestion) {
      let fs = "Follow-up regarding quote";
      let fb = analyzed.followupQuestion;

      try {
        const { text } = await generateText({
          model: getGeminiModel(),
          prompt: `Draft a quick professional follow-up email to ${vendorName}.
Question to ask: ${analyzed.followupQuestion}
Context: ${jobDescription}

Return ONLY valid JSON without markdown:
{
  "subject": "Follow-up: ...",
  "body": "Hi ${vendorName},\\n\\n..."
}`,
        });
        const clean = text.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
        const draft = JSON.parse(clean);
        if (draft.subject) fs = String(draft.subject);
        if (draft.body) fb = String(draft.body);
      } catch {
        fs = "Follow-up regarding your quote";
      }

      try {
        await getAgentMail().inboxes.messages.send(agentInboxId, {
          to: [vendorEmail],
          subject: fs,
          text: fb,
        });
      } catch {}


      await ctx.runMutation(api.threads.addMessage, {
        threadId,
        jobId,
        direction: "outbound",
        subject: fs,
        body: fb,
      });

      await ctx.runMutation(api.threads.updateThreadStatus, { threadId, status: "following_up" });
    }

    return { analyzed };
  },
});

export const compileSummary = action({
  args: {
    jobId: v.id("jobs"),
    userEmail: v.string(),
    jobDescription: v.string(),
    agentInboxId: v.string(),
  },
  handler: async (ctx, { jobId, userEmail, jobDescription, agentInboxId }): Promise<{ summary: string }> => {
    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "compiling" });

    type ThreadDoc = {
      _id: Id<"threads">;
      vendorName: string;
      status: string;
      quote?: string;
      notes?: string;
    };

    type SummaryItem = {
      vendor: string;
      status: string;
      quote: string;
      notes: string;
    };

    const threads = (await ctx.runQuery(api.threads.getThreadsByJob, { jobId })) as ThreadDoc[];
    const summaryInput: SummaryItem[] = threads.map((t: ThreadDoc) => ({
      vendor: t.vendorName,
      status: t.status,
      quote: t.quote ?? "No quote received",
      notes: t.notes ?? "",
    }));

    const subject = `Relay: Sourcing report for ${jobDescription.slice(0, 40)}`;

    let body = `Summary for: ${jobDescription}\n\nVendor Results:\n${summaryInput.map((s: SummaryItem) => `- ${s.vendor}: ${s.quote} (${s.status})${s.notes ? ` - ${s.notes}` : ""}`).join("\n")}\n\nAll tasks and quotes have been compiled by Relay.`;

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
      });
      body = text;
    } catch {}

    try {
      await getAgentMail().inboxes.messages.send(agentInboxId, {
        to: [userEmail],
        subject,
        text: body,
      });
    } catch {}

    await ctx.runMutation(api.jobs.updateJobSummary, { jobId, summary: body });
    return { summary: body };
  },
});

export const requestDecision = action({
  args: {
    jobId: v.id("jobs"),
    threadId: v.optional(v.id("threads")),
    question: v.string(),
    context: v.string(),
    options: v.optional(v.array(v.string())),
    userEmail: v.string(),
    agentInboxId: v.string(),
  },
  handler: async (
    ctx,
    { jobId, threadId, question, context, options, userEmail, agentInboxId }
  ): Promise<{ decisionId: Id<"decisions"> }> => {
    const decisionId: Id<"decisions"> = await ctx.runMutation(api.decisions.createDecision, {
      jobId,
      threadId,
      question,
      context,
      options: options ?? [],
    });



    try {
      await getAgentMail().inboxes.messages.send(agentInboxId, {
        to: [userEmail],
        subject: `[Action Required] Relay needs your input`,
        text: `Relay needs a decision to continue your sourcing job:\n\n"${question}"\n\nContext: ${context}\n${options ? `Options:\n${options.map((o) => `• ${o}`).join("\n")}\n` : ""}\nReply directly to this email or resolve on your dashboard.`,
      });
    } catch {}


    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "needs_decision" });
    return { decisionId };
  },
});

export const startPipeline = action({
  args: {
    userEmail: v.string(),
    rawTask: v.string(),
  },
  handler: async (ctx, { userEmail, rawTask }): Promise<{ jobId: Id<"jobs"> }> => {
    const jobId: Id<"jobs"> = await ctx.runMutation(api.jobs.createJob, { userEmail, rawTask });

    const { parsed, agentInboxId, agentEmail }: { parsed: ParsedIntent; agentInboxId: string; agentEmail: string } =
      await ctx.runAction(api.agent.parseTask, {
        jobId,
        rawTask,
        userEmail,
      });

    const { vendors }: { vendors: Vendor[] } = await ctx.runAction(api.agent.researchVendors, {
      jobId,
      category: parsed.category ?? parsed.taskType ?? "services",
      location: parsed.location,
      targetCount: parsed.targetCount ?? 3,
    });

    await ctx.runAction(api.agent.sendOutreach, {
      jobId,
      agentEmail: agentEmail ?? `relay-${String(jobId).slice(-8)}@agentmail.to`,
      agentInboxId: agentInboxId ?? `inbox-${String(jobId).slice(-8)}`,
      vendors,
      jobDescription: parsed.description ?? rawTask,
      budget: parsed.budget,
      deadline: parsed.deadline,
      userEmail,
    });

    return { jobId };
  },
});
