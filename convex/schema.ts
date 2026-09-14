import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  jobs: defineTable({
    userEmail: v.string(),
    rawTask: v.string(),
    parsedIntent: v.optional(v.object({
      taskType: v.string(),
      description: v.string(),
      targetCount: v.optional(v.number()),
      location: v.optional(v.string()),
      budget: v.optional(v.string()),
      deadline: v.optional(v.string()),
      category: v.optional(v.string()),
    })),
    status: v.union(
      v.literal("received"),
      v.literal("parsing"),
      v.literal("researching"),
      v.literal("outreaching"),
      v.literal("awaiting_replies"),
      v.literal("needs_decision"),
      v.literal("compiling"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    summary: v.optional(v.string()),
    agentInboxId: v.optional(v.string()),
    agentEmail: v.optional(v.string()),
    firecrawlResults: v.optional(v.array(v.object({
      name: v.string(),
      url: v.optional(v.string()),
      description: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
    }))),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]).index("by_user", ["userEmail"]),

  threads: defineTable({
    jobId: v.id("jobs"),
    vendorName: v.string(),
    vendorEmail: v.string(),
    agentInboxId: v.string(),
    agentEmail: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("replied"),
      v.literal("following_up"),
      v.literal("quote_received"),
      v.literal("declined"),
      v.literal("no_response"),
    ),
    quote: v.optional(v.string()),
    notes: v.optional(v.string()),
    lastActivity: v.number(),
  }).index("by_job", ["jobId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    jobId: v.id("jobs"),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    subject: v.string(),
    body: v.string(),
    timestamp: v.number(),
    agentMailMessageId: v.optional(v.string()),
  }).index("by_thread", ["threadId"]).index("by_job", ["jobId"]),

  decisions: defineTable({
    jobId: v.id("jobs"),
    question: v.string(),
    options: v.array(v.string()),
    context: v.optional(v.string()),
    userReply: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("resolved")),
  }).index("by_job", ["jobId"]),
});
