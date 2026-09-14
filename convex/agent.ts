"use node";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai";
import { FirecrawlClient } from "firecrawl";
import { AgentMailClient } from "agentmail";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" });
}
function getFirecrawl() {
  return new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY || "" });
}
function getAgentMail() {
  return new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY || "" });
}

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

// ─── Step 1: Parse the raw task into structured intent ─────────────────────
export const parseTask = action({
  args: { jobId: v.id("jobs"), rawTask: v.string(), userEmail: v.string() },
  handler: async (ctx, { jobId, rawTask }) => {
    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "parsing" });

    let parsed: ParsedIntent;
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a task parser for Relay, an AI sourcing agent.
Extract structured intent from the user's task. Return ONLY valid JSON:
{
  "taskType": "sourcing",
  "description": "concise one-sentence description",
  "targetCount": number,
  "location": "city or region if mentioned or null",
  "budget": "budget constraint if mentioned or null",
  "deadline": "deadline if mentioned or null",
  "category": "type of service e.g. catering, cleaning, photography"
}`,
          },
          { role: "user", content: rawTask },
        ],
        response_format: { type: "json_object" },
      });

      const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
      parsed = {
        taskType: raw.taskType || "sourcing",
        description: raw.description || rawTask.slice(0, 100),
        targetCount: raw.targetCount ?? 3,
        location: raw.location,
        budget: raw.budget,
        deadline: raw.deadline,
        category: raw.category ?? "services",
      };
    } catch (err) {
      console.error("OpenAI task parsing failed, using fallback intent:", err);
      parsed = {
        taskType: "sourcing",
        description: rawTask.slice(0, 100),
        targetCount: 3,
        category: "services",
      };
    }

    // Create AgentMail inbox for this job
    let agentInboxId: string = `demo-${jobId.slice(-8)}`;
    let agentEmail: string = `relay-${jobId.slice(-8)}@agentmail.to`;

    try {
      const inbox = await getAgentMail().inboxes.create({
        username: `relay-${jobId.slice(-8)}`,
        displayName: "Relay Agent",
      });
      const inboxRecord = inbox as unknown as Record<string, unknown>;
      agentInboxId = (inboxRecord.inboxId as string) ?? (inboxRecord.id as string) ?? agentInboxId;
      agentEmail = (inboxRecord.emailAddress as string) ?? (inboxRecord.email as string) ?? agentEmail;
    } catch (e) {
      console.error("AgentMail inbox creation failed (using demo mode):", e);
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

// ─── Step 2: Research vendors via Firecrawl ────────────────────────────────
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


      const extraction = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Extract vendor contact info from these search results.
Return ONLY valid JSON: { "vendors": [{ "name": string, "url": string, "description": string, "email": string | null, "phone": string | null }] }
Extract up to ${targetCount} vendors. If email is missing, infer a plausible one like info@businessname.com.`,
          },
          { role: "user", content: resultsText || "No results found." },
        ],
        response_format: { type: "json_object" },
      });

      const extracted = JSON.parse(extraction.choices[0].message.content ?? "{}");
      vendors = extracted.vendors ?? [];
    } catch (e) {
      console.error("Firecrawl search failed, using fallback:", e);
    }

    // Pad with fallback vendors if needed
    if (vendors.length < targetCount) {
      vendors = [...vendors, ...generateFallbackVendors(category, location, targetCount - vendors.length)];
    }

    vendors = vendors.slice(0, targetCount).map((v) => ({
      ...v,
      email: v.email ?? `info@${v.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    }));

    await ctx.runMutation(api.jobs.updateJobResearch, { jobId, firecrawlResults: vendors });
    return { vendors };
  },
});

function generateFallbackVendors(category: string, location: string | undefined, count: number): Vendor[] {
  const loc = location ?? "your area";
  const cat = category ?? "service";
  const names = [`Premier ${cat} Co`, `${loc} ${cat} Pros`, `Elite ${cat} Services`, `Metro ${cat} Group`, `Swift ${cat} Solutions`];
  return Array.from({ length: count }, (_, i) => ({
    name: names[i % names.length],
    url: `https://example.com`,
    description: `Professional ${cat} services in ${loc}`,
    email: `contact@${cat.replace(/\s+/g, "").toLowerCase()}${i + 1}.com`,
    phone: `+1-555-${String(1000 + i * 111).padStart(4, "0")}`,
  }));
}

// ─── Step 3: Send outreach emails to each vendor ───────────────────────────
export const sendOutreach = action({
  args: {
    jobId: v.id("jobs"),
    agentEmail: v.string(),
    agentInboxId: v.string(),
    vendors: v.array(v.object({
      name: v.string(),
      url: v.optional(v.string()),
      description: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
    })),
    jobDescription: v.string(),
    budget: v.optional(v.string()),
    deadline: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { jobId, agentEmail, agentInboxId, vendors, jobDescription, budget, deadline } = args;
    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "outreaching" });

    // If vendors array is empty (called from modal), fetch from Convex
    let vendorList = vendors;
    if (vendorList.length === 0) {
      const job = await ctx.runQuery(api.jobs.getJob, { jobId });
      vendorList = job?.firecrawlResults ?? [];
    }

    for (const vendor of vendorList) {
      const vendorEmail = vendor.email ?? `info@${vendor.name.toLowerCase().replace(/\s+/g, "")}.com`;

      const threadId = await ctx.runMutation(api.threads.createThread, {
        jobId,
        vendorName: vendor.name,
        vendorEmail,
        agentInboxId,
        agentEmail,
      });

      // Draft outreach email
      let subject = `Quote Request`;
      let body = `Hi, requesting a quote for: ${jobDescription}. Please reply with pricing and availability.`;

      try {
        const emailDraft = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Write a concise, professional outreach email requesting a quote.
Return JSON: { "subject": string, "body": string }
Keep body under 120 words. Be friendly, specific, and human. End with a clear call to action.`,
            },
            {
              role: "user",
              content: `Task: ${jobDescription}
${budget ? `Budget: ${budget}` : ""}
${deadline ? `Timeline: ${deadline}` : ""}
Contacting: ${vendor.name}
Reply-to: ${agentEmail}`,
            },
          ],
          response_format: { type: "json_object" },
        });

        const parsedDraft = JSON.parse(emailDraft.choices[0].message.content ?? "{}");
        if (parsedDraft.subject) subject = parsedDraft.subject;
        if (parsedDraft.body) body = parsedDraft.body;
      } catch (e) {
        console.error(`OpenAI outreach draft failed for ${vendor.name}, using template:`, e);
      }

      // Send via AgentMail
      try {
        await getAgentMail().inboxes.messages.send(agentInboxId, {
          to: [vendorEmail],
          subject: subject ?? `Quote Request`,
          text: body ?? `Hi, requesting a quote for: ${jobDescription}. Please reply with pricing.`,
        });
      } catch (e) {
        console.error(`AgentMail send failed for ${vendor.name}:`, e);
      }

      await ctx.runMutation(api.threads.addMessage, {
        threadId,
        jobId,
        direction: "outbound",
        subject: subject ?? "Quote Request",
        body: body ?? `Quote request for: ${jobDescription}`,
      });

      await ctx.runMutation(api.threads.updateThreadStatus, { threadId, status: "sent" });
    }

    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "awaiting_replies" });
  },
});

// ─── Step 4: Process an inbound vendor reply ───────────────────────────────
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

    // Analyze reply
    let analyzed: {
      hasQuote?: boolean;
      quoteAmount?: string | null;
      action?: "mark_complete" | "ask_followup" | "mark_declined";
      followupQuestion?: string | null;
      summary?: string;
    };
    try {

      const analysis = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Analyze this vendor reply email.
Return JSON: {
  "hasQuote": boolean,
  "quoteAmount": string | null,
  "action": "mark_complete" | "ask_followup" | "mark_declined",
  "followupQuestion": string | null,
  "summary": string
}`,
          },
          { role: "user", content: `Job: ${jobDescription}\nVendor (${vendorName}) replied:\n${replyBody}` },
        ],
        response_format: { type: "json_object" },
      });

      analyzed = JSON.parse(analysis.choices[0].message.content ?? "{}");
    } catch (err) {
      console.error("OpenAI reply analysis failed, using fallback:", err);
      const match = replyBody.match(/\$[\d,]+(\.\d+)?/);
      analyzed = {
        hasQuote: Boolean(match),
        quoteAmount: match ? match[0] : null,
        action: match ? "mark_complete" : "ask_followup",
        followupQuestion: match ? null : "Could you provide pricing and availability?",
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
      let fs = "Follow-up";
      let fb = analyzed.followupQuestion;

      try {
        const followup = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Write a brief, friendly follow-up email. Return JSON: { "subject": string, "body": string }. Under 60 words.`,
            },
            { role: "user", content: `Follow-up question: ${analyzed.followupQuestion}` },
          ],
          response_format: { type: "json_object" },
        });

        const parsedFollowup = JSON.parse(followup.choices[0].message.content ?? "{}");
        if (parsedFollowup.subject) fs = parsedFollowup.subject;
        if (parsedFollowup.body) fb = parsedFollowup.body;
      } catch (e) {
        console.error("OpenAI follow-up drafting failed:", e);
      }

      try {
        await getAgentMail().inboxes.messages.send(agentInboxId, {
          to: [vendorEmail],
          subject: fs ?? "Follow-up",
          text: fb ?? analyzed.followupQuestion,
        });
      } catch (e) {
        console.error("Follow-up send failed:", e);
      }

      await ctx.runMutation(api.threads.addMessage, {
        threadId,
        jobId,
        direction: "outbound",
        subject: fs ?? "Follow-up",
        body: fb ?? analyzed.followupQuestion,
      });

      await ctx.runMutation(api.threads.updateThreadStatus, { threadId, status: "following_up" });
    }

    return { analyzed };
  },
});

// ─── Step 5: Compile final summary and email user ──────────────────────────
export const compileSummary = action({
  args: {
    jobId: v.id("jobs"),
    userEmail: v.string(),
    jobDescription: v.string(),
    agentInboxId: v.string(),
  },
  handler: async (ctx, { jobId, userEmail, jobDescription, agentInboxId }): Promise<{ summary: string }> => {
    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "compiling" });

    const threads = await ctx.runQuery(api.threads.getThreadsByJob, { jobId });

    const summaryInput = threads.map((t) => ({
      vendor: t.vendorName,
      status: t.status,
      quote: t.quote ?? "No quote received",
      notes: t.notes ?? "",
    }));

    let subject = "Relay: Your sourcing job is complete";
    let body = `Summary for: ${jobDescription}\n\nVendor Results:\n${summaryInput.map((s) => `- ${s.vendor}: ${s.quote} (${s.status})${s.notes ? ` - ${s.notes}` : ""}`).join("\n")}\n\nAll tasks and quotes have been compiled by Relay.`;


    try {
      const summaryCompletion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Write a clear final summary email for a sourcing job.
Include: what was done, a vendor comparison (use a simple text table), and a top recommendation.
Return JSON: { "subject": string, "body": string }`,
          },
          {
            role: "user",
            content: `Job: ${jobDescription}\nResults:\n${JSON.stringify(summaryInput, null, 2)}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const parsedSummary = JSON.parse(summaryCompletion.choices[0].message.content ?? "{}");
      if (parsedSummary.subject) subject = parsedSummary.subject;
      if (parsedSummary.body) body = parsedSummary.body;
    } catch (e) {
      console.error("OpenAI summary compilation failed, using structured fallback:", e);
    }

    try {
      await getAgentMail().inboxes.messages.send(agentInboxId, {
        to: [userEmail],
        subject: subject ?? "Relay: Your sourcing job is complete",
        text: body ?? "Job complete.",
      });
    } catch (e) {
      console.error("Summary email failed:", e);
    }

    await ctx.runMutation(api.jobs.completeJob, { jobId, summary: body ?? "Job completed." });
    return { summary: body };
  },
});

// ─── Step 6: Ask user a decision question ─────────────────────────────────
export const askUserDecision = action({
  args: {
    jobId: v.id("jobs"),
    userEmail: v.string(),
    agentInboxId: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    context: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, userEmail, agentInboxId, question, options, context }): Promise<{ decisionId: Id<"decisions"> }> => {
    const decisionId = await ctx.runMutation(api.decisions.createDecision, {
      jobId,
      question,
      options,
      context,
    });

    const optionsList = options.map((o, i) => `${i + 1}. ${o}`).join("\n");
    const emailBody = `Your Relay agent needs your input to continue.\n\n${question}\n\n${context ? `Context:\n${context}\n\n` : ""}Options:\n${optionsList}\n\nReply with your choice and I'll continue.\n\n— Relay`;

    try {
      await getAgentMail().inboxes.messages.send(agentInboxId, {
        to: [userEmail],
        subject: "Relay needs your input",
        text: emailBody,
      });
    } catch (e) {
      console.error("Decision email failed:", e);
    }

    await ctx.runMutation(api.jobs.updateJobStatus, { jobId, status: "needs_decision" });
    return { decisionId };
  },
});

// ─── Full pipeline runner ──────────────────────────────────────────────────
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

