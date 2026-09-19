import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'sync active agentmail inboxes',
  { minutes: 1 },
  internal.agent.syncAllActiveInboxes,
  {},
)

export default crons
