import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const createJob = mutation({
  args: {
    userEmail: v.string(),
    rawTask: v.string(),
  },
  handler: async (ctx, { userEmail, rawTask }) => {
    const now = Date.now()
    const jobId = await ctx.db.insert('jobs', {
      userEmail,
      rawTask,
      status: 'received',
      createdAt: now,
      updatedAt: now,
    })
    return jobId
  },
})

export const updateJobStatus = mutation({
  args: {
    jobId: v.id('jobs'),
    status: v.union(
      v.literal('received'),
      v.literal('parsing'),
      v.literal('researching'),
      v.literal('outreaching'),
      v.literal('awaiting_replies'),
      v.literal('needs_decision'),
      v.literal('compiling'),
      v.literal('completed'),
      v.literal('failed'),
    ),
  },
  handler: async (ctx, { jobId, status }) => {
    await ctx.db.patch(jobId, { status, updatedAt: Date.now() })
  },
})

export const updateJobParsed = mutation({
  args: {
    jobId: v.id('jobs'),
    parsedIntent: v.object({
      taskType: v.string(),
      description: v.string(),
      targetCount: v.optional(v.number()),
      location: v.optional(v.string()),
      budget: v.optional(v.string()),
      deadline: v.optional(v.string()),
      category: v.optional(v.string()),
    }),
    agentInboxId: v.optional(v.string()),
    agentEmail: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, parsedIntent, agentInboxId, agentEmail }) => {
    await ctx.db.patch(jobId, {
      parsedIntent,
      agentInboxId,
      agentEmail,
      status: 'researching',
      updatedAt: Date.now(),
    })
  },
})

export const updateJobResearch = mutation({
  args: {
    jobId: v.id('jobs'),
    firecrawlResults: v.array(
      v.object({
        name: v.string(),
        url: v.optional(v.string()),
        description: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { jobId, firecrawlResults }) => {
    await ctx.db.patch(jobId, {
      firecrawlResults,
      status: 'outreaching',
      updatedAt: Date.now(),
    })
  },
})

export const updateJobVendors = mutation({
  args: {
    jobId: v.id('jobs'),
    vendors: v.array(
      v.object({
        name: v.string(),
        url: v.optional(v.string()),
        description: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { jobId, vendors }) => {
    await ctx.db.patch(jobId, {
      firecrawlResults: vendors,
      status: 'outreaching',
      updatedAt: Date.now(),
    })
  },
})


export const completeJob = mutation({
  args: {
    jobId: v.id('jobs'),
    summary: v.string(),
  },
  handler: async (ctx, { jobId, summary }) => {
    await ctx.db.patch(jobId, {
      summary,
      status: 'completed',
      updatedAt: Date.now(),
    })
  },
})

export const updateJobSummary = mutation({
  args: {
    jobId: v.id('jobs'),
    summary: v.string(),
  },
  handler: async (ctx, { jobId, summary }) => {
    await ctx.db.patch(jobId, {
      summary,
      status: 'completed',
      updatedAt: Date.now(),
    })
  },
})


export const listJobs = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, { userEmail }) => {
    if (userEmail) {
      return await ctx.db
        .query('jobs')
        .withIndex('by_user', q => q.eq('userEmail', userEmail))
        .order('desc')
        .collect()
    }
    return await ctx.db.query('jobs').order('desc').take(50)
  },
})

export const getJob = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId)
  },
})
