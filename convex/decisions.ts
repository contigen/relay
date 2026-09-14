import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createDecision = mutation({
  args: {
    jobId: v.id("jobs"),
    threadId: v.optional(v.id("threads")),
    question: v.string(),
    options: v.array(v.string()),
    context: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    return await ctx.db.insert("decisions", {
      ...args,
      status: "pending",
    });
  },
});

export const resolveDecision = mutation({
  args: {
    decisionId: v.id("decisions"),
    userReply: v.string(),
  },
  handler: async (ctx, { decisionId, userReply }) => {
    await ctx.db.patch(decisionId, {
      userReply,
      resolvedAt: Date.now(),
      status: "resolved",
    });
  },
});

export const getDecisionsByJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();
  },
});

export const getPendingDecision = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();
    return decisions.find((d) => d.status === "pending") ?? null;
  },
});
