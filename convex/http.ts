import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, components } from "./_generated/api";
import { registerStaticRoutes } from "@convex-dev/static-hosting";

const http = httpRouter();

http.route({
  path: "/webhook/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    const inboxId: string = body.inboxId ?? body.inbox_id;
    const from: string = body.from?.email ?? body.from;
    const messageBody: string = body.text ?? body.body ?? body.content ?? "";

    if (!inboxId || !messageBody) {
      return new Response("Missing required fields", { status: 400 });
    }

    const jobs = await ctx.runQuery(api.jobs.listJobs, {});
    const job = jobs.find(
      (j) => j.agentInboxId === inboxId || j.agentEmail?.includes(inboxId)
    );

    if (!job) {
      return new Response("No job found for inbox", { status: 404 });
    }

    const threads = await ctx.runQuery(api.threads.getThreadsByJob, {
      jobId: job._id,
    });
    const thread = threads.find((t) => t.vendorEmail === from);

    if (!thread) {
      if (from === job.userEmail) {
        const pending = await ctx.runQuery(api.decisions.getPendingDecision, {
          jobId: job._id,
        });
        if (pending) {
          await ctx.runMutation(api.decisions.resolveDecision, {
            decisionId: pending._id,
            userReply: messageBody,
          });
          await ctx.runAction(api.agent.compileSummary, {
            jobId: job._id,
            userEmail: job.userEmail,
            jobDescription: job.parsedIntent?.description ?? job.rawTask,
            agentInboxId: job.agentInboxId!,
          });
        }
      }
      return new Response("OK", { status: 200 });
    }

    await ctx.runAction(api.agent.processReply, {
      jobId: job._id,
      threadId: thread._id,
      replyBody: messageBody,
      vendorName: thread.vendorName,
      agentInboxId: job.agentInboxId!,
      agentEmail: job.agentEmail!,
      vendorEmail: from,
      jobDescription: job.parsedIntent?.description ?? job.rawTask,
    });

    return new Response("OK", { status: 200 });
  }),
});

http.route({
  path: "/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    const userEmail: string = body.from?.email ?? body.from ?? "";
    const rawTask: string = body.text ?? body.body ?? body.content ?? "";

    if (!userEmail || !rawTask) {
      return new Response("Missing fields", { status: 400 });
    }

    const jobId = await ctx.runMutation(api.jobs.createJob, { userEmail, rawTask });

    await ctx.runAction(api.agent.parseTask, { jobId, rawTask, userEmail });

    const job = await ctx.runQuery(api.jobs.getJob, { jobId });
    if (job?.parsedIntent && job.agentInboxId && job.agentEmail) {
      await ctx.runAction(api.agent.researchVendors, {
        jobId,
        category: job.parsedIntent.category ?? job.parsedIntent.taskType,
        location: job.parsedIntent.location,
        targetCount: job.parsedIntent.targetCount ?? 3,
      });

      const updatedJob = await ctx.runQuery(api.jobs.getJob, { jobId });
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
        });
      }
    }

    return new Response(JSON.stringify({ jobId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

registerStaticRoutes(http, components.staticHosting);

export default http;
