import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const createThread = mutation({
  args: {
    jobId: v.id('jobs'),
    vendorName: v.string(),
    vendorEmail: v.string(),
    vendorUrl: v.optional(v.string()),
    agentInboxId: v.string(),

    agentEmail: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('threads', {
      ...args,
      status: 'pending',
      lastActivity: Date.now(),
    })
  },
})

export const updateThreadStatus = mutation({
  args: {
    threadId: v.id('threads'),
    status: v.union(
      v.literal('pending'),
      v.literal('sent'),
      v.literal('replied'),
      v.literal('following_up'),
      v.literal('quote_received'),
      v.literal('declined'),
      v.literal('no_response'),
    ),
    quote: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, status, quote, notes }) => {
    const patch: Record<string, unknown> = { status, lastActivity: Date.now() }
    if (quote !== undefined) patch.quote = quote
    if (notes !== undefined) patch.notes = notes
    await ctx.db.patch(threadId, patch)
  },
})

export const addMessage = mutation({
  args: {
    threadId: v.id('threads'),
    jobId: v.id('jobs'),
    direction: v.union(v.literal('outbound'), v.literal('inbound')),
    subject: v.string(),
    body: v.string(),
    agentMailMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('messages', {
      ...args,
      timestamp: Date.now(),
    })
  },
})

export const getThreadsByJob = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query('threads')
      .withIndex('by_job', q => q.eq('jobId', jobId))
      .collect()
  },
})

export const getMessagesByThread = query({
  args: { threadId: v.id('threads') },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query('messages')
      .withIndex('by_thread', q => q.eq('threadId', threadId))
      .order('asc')
      .collect()
  },
})

export const getMessagesByJob = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query('messages')
      .withIndex('by_job', q => q.eq('jobId', jobId))
      .order('asc')
      .collect()
  },
})
