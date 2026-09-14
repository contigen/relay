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

    let agentInboxId = "";
    let agentEmail = "";

    try {
      const inboxesList = await getAgentMail().inboxes.list();
      const firstInbox = inboxesList.inboxes?.[0];
      if (firstInbox) {
        agentInboxId = firstInbox.inboxId;
        agentEmail = firstInbox.email;
      } else {
        const inbox = await getAgentMail().inboxes.create({
          displayName: "Relay Agent",
        });
        agentInboxId = inbox.inboxId;
        agentEmail = inbox.email;
      }
    } catch (err) {
      console.error("AGENTMAIL_INIT_ERROR:", err);
      throw new Error(`Failed to initialize AgentMail inbox: ${err instanceof Error ? err.message : String(err)}`);
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
      const searchResults = await getFirecrawl().search(searchQuery, { limit: targetCount + 5 });
      const searchRecord = searchResults as Record<string, unknown>;
      const rawList: Array<Record<string, unknown>> = Array.isArray(searchRecord.web)
        ? (searchRecord.web as Array<Record<string, unknown>>)
        : Array.isArray(searchResults)
          ? searchResults
          : Array.isArray(searchRecord.data)
            ? (searchRecord.data as Array<Record<string, unknown>>)
            : [];

      const resultsText = rawList
        .slice(0, 8)
        .map((r: Record<string, unknown>) =>
          `URL: ${r.url ?? ""}\nTitle: ${r.title ?? ""}\nDescription: ${r.description ?? ""}\nContent: ${String(r.markdown ?? r.content ?? "").slice(0, 400)}`
        )
        .join("\n---\n");

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
        });

        const clean = text.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
        const parsedVendors = JSON.parse(clean);
        if (Array.isArray(parsedVendors) && parsedVendors.length > 0) {
          vendors = parsedVendors
            .filter((v: Record<string, unknown>) => v && typeof v.name === "string" && v.name.trim().length > 0)
            .map((v: Record<string, unknown>) => {
              let email = typeof v.email === "string" && v.email.includes("@") ? v.email.trim() : undefined;
              if (!email && typeof v.url === "string") {
                try {
                  const host = new URL(v.url).hostname.replace(/^www\./, "");
                  if (host && host.includes(".")) {
                    email = `contact@${host}`;
                  }
                } catch {}
              }
              return {
                name: String(v.name).trim(),
                url: typeof v.url === "string" ? v.url.trim() : undefined,
                description: typeof v.description === "string" ? v.description.trim() : undefined,
                email,
                phone: typeof v.phone === "string" ? v.phone.trim() : undefined,
              };
            });
        }
      }
    } catch (err) {
      console.error("Firecrawl vendor research error:", err);
      vendors = [];
    }

    if (vendors.length === 0) {
      await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "failed" });
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
    if (!vendors || vendors.length === 0) {
      await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "failed" });
      return;
    }

    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "outreaching" });

    let sentCount = 0;
    for (const vendor of vendors) {
      const vendorEmail = vendor.email;
      if (!vendorEmail || !vendorEmail.includes("@")) {
        continue;
      }

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
      sentCount++;
    }

    if (sentCount === 0) {
      await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "failed" });
      return;
    }

    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "awaiting_replies" });

    try {
      await getAgentMail().inboxes.messages.send(agentInboxId, {
        to: [userEmail],
        subject: `Relay: We reached out to ${sentCount} vendors`,
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
      });
    } catch (err) {
      console.error("sendOutreach failed:", err);
      await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "failed" });
      throw err;
    }

    return { jobId };
  },
});
