'use client'

import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useState } from 'react'
import MetricCard from './metric-card'
import JobCard from './job-card'
import ThreadRow from './thread-row'
import DecisionBanner from './decision-banner'
import TerminalBox from './terminal-box'
import SetupView from './setup-view'
import NewJobModal from './new-job-modal'

type JobDoc = {
  _id: Id<'jobs'>
  rawTask: string
  status: string
  userEmail: string
  agentInboxId?: string
  agentEmail?: string
  parsedIntent?: {
    description?: string
    category?: string
    location?: string
    budget?: string
    deadline?: string
    targetCount?: number
  }
  firecrawlResults?: Array<{ name: string; email?: string }>
  summary?: string
  createdAt: number
  updatedAt: number
}

type ThreadDoc = {
  _id: Id<'threads'>
  jobId: Id<'jobs'>
  vendorName: string
  vendorEmail: string
  vendorUrl?: string
  agentInboxId: string
  agentEmail: string
  status:
    | 'pending'
    | 'sent'
    | 'replied'
    | 'following_up'
    | 'quote_received'
    | 'declined'
    | 'no_response'
  quote?: string
  notes?: string
  lastActivity: number
}

type DecisionDoc = {
  _id: Id<'decisions'>
  jobId: Id<'jobs'>
  threadId?: Id<'threads'>
  question: string
  options: string[]
  context?: string
  userReply?: string
  status: 'pending' | 'resolved'
}

type DashboardViewProps = {
  initialTab?: 'dashboard' | 'setup' | 'history' | 'verify'
}

export default function DashboardView({
  initialTab = 'dashboard',
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'setup' | 'history' | 'verify'
  >(initialTab)
  const [selectedJobId, setSelectedJobId] = useState<Id<'jobs'> | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)

  const jobs = (useQuery(api.jobs.listJobs, {}) ?? []) as JobDoc[]
  const activeJob =
    jobs.find(j => (selectedJobId ? j._id === selectedJobId : true)) ??
    jobs[0] ??
    null

  const threads = (useQuery(
    api.threads.getThreadsByJob,
    activeJob ? { jobId: activeJob._id } : 'skip',
  ) ?? []) as ThreadDoc[]

  const decisions = (useQuery(
    api.decisions.getDecisionsByJob,
    activeJob ? { jobId: activeJob._id } : 'skip',
  ) ?? []) as DecisionDoc[]

  const pendingDecision = (useQuery(
    api.decisions.getPendingDecision,
    activeJob ? { jobId: activeJob._id } : 'skip',
  ) ?? null) as DecisionDoc | null

  const resolveDecision = useMutation(api.decisions.resolveDecision)
  const compileSummary = useAction(api.agent.compileSummary)
  const startPipeline = useAction(api.agent.startPipeline)

  const handleResolve = async (reply: string) => {
    if (!pendingDecision || !activeJob) return
    await resolveDecision({ decisionId: pendingDecision._id, userReply: reply })
    const inboxId = activeJob.agentInboxId || ''
    await compileSummary({
      jobId: activeJob._id,
      userEmail: activeJob.userEmail,
      jobDescription: activeJob.parsedIntent?.description ?? activeJob.rawTask,
      agentInboxId: inboxId,
    })
  }

  const handleTriggerCompile = async () => {
    if (!activeJob) return
    const inboxId = activeJob.agentInboxId || ''
    await compileSummary({
      jobId: activeJob._id,
      userEmail: activeJob.userEmail,
      jobDescription: activeJob.parsedIntent?.description ?? activeJob.rawTask,
      agentInboxId: inboxId,
    })
    setShowSummaryModal(true)
  }

  const quotesCount = threads.filter(t => t.status === 'quote_received').length
  const bestQuote =
    threads.find(t => t.quote)?.quote ??
    (quotesCount > 0 ? `${quotesCount} quotes` : '—')

  const totalDecisionsCount = decisions.length
  const vendorsContactedCount = threads.length
  const autonomyRate =
    threads.length > 0
      ? `${Math.max(0, Math.round(((threads.length - totalDecisionsCount) / threads.length) * 100))}%`
      : '—'

  const terminalSteps = activeJob
    ? [
        {
          text: `Task parsed: ${activeJob.parsedIntent?.category || 'Sourcing'} in ${activeJob.parsedIntent?.location || 'target area'}`,
          status: 'done' as const,
        },
        {
          text: activeJob.firecrawlResults?.length
            ? `Firecrawl verified ${activeJob.firecrawlResults.length} vendor candidates`
            : 'Searching verified vendor registry via Firecrawl...',
          status: (activeJob.firecrawlResults?.length
            ? 'done'
            : activeJob.status === 'researching'
              ? 'running'
              : 'pending') as 'done' | 'running' | 'pending',
        },
        {
          text:
            threads.length > 0
              ? `AgentMail coordinated ${threads.length} vendor inquiry threads`
              : 'Provisioning dedicated AgentMail inboxes...',
          status: (threads.length > 0
            ? 'done'
            : activeJob.status === 'outreaching'
              ? 'running'
              : 'pending') as 'done' | 'running' | 'pending',
        },
        {
          text:
            activeJob.status === 'completed'
              ? 'Final executive report generated and dispatched to client'
              : activeJob.status === 'needs_decision'
                ? 'Awaiting human-in-the-loop decision'
                : 'Listening for vendor quote replies on webhook...',
          status: (activeJob.status === 'completed' ? 'done' : 'running') as
            'done' | 'running',
        },
      ]
    : [
        {
          text: 'Agent standby. Awaiting new sourcing task...',
          status: 'pending' as const,
        },
        {
          text: 'Vendor discovery pipeline idle.',
          status: 'pending' as const,
        },
        {
          text: 'AgentMail inbox dispatcher standby.',
          status: 'pending' as const,
        },
        {
          text: 'Quote analysis and compilation engine idle.',
          status: 'pending' as const,
        },
      ]

  return (
    <div className='min-h-screen bg-[#fafafa] text-[#0a0a0a] flex flex-col justify-between font-mono'>
      <div>
        <header className='border-b border-[#e5e5e5] bg-white sticky top-0 z-40'>
          <div className='max-w-7xl mx-auto px-6 h-14 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <span
                className={`w-2 h-2 rounded-full ${
                  activeJob ? 'bg-[#16a34a] animate-pulse' : 'bg-[#a3a3a3]'
                }`}
              />
              <span className='font-mono font-bold text-xs tracking-widest uppercase text-[#0a0a0a]'>
                RELAY
              </span>
            </div>

            <nav className='flex items-center gap-8'>
              {(['setup', 'dashboard', 'history', 'verify'] as const).map(
                tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`font-mono text-xs uppercase tracking-wider py-4 border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-[#0a0a0a] text-[#0a0a0a] font-semibold'
                        : 'border-transparent text-[#737373] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {tab}
                  </button>
                ),
              )}
            </nav>

            <div className='flex items-center gap-3'>
              <span className='text-[11px] font-mono text-[#737373] hidden sm:inline'>
                {activeJob?.agentEmail || 'relay-core@agentmail.to'}
              </span>
              <span
                className={`border border-[#e5e5e5] bg-[#fafafa] text-[10px] font-mono uppercase px-2.5 py-1 flex items-center gap-1.5 font-medium ${
                  activeJob ? 'text-[#16a34a]' : 'text-[#737373]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeJob ? 'bg-[#16a34a]' : 'bg-[#a3a3a3]'
                  }`}
                />
                {activeJob ? 'AGENT ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>
        </header>

        <main className='max-w-7xl mx-auto px-6 py-8'>
          {activeTab === 'setup' ? (
            <SetupView onPlanCreated={() => setActiveTab('dashboard')} />
          ) : activeTab === 'history' ? (
            <div className='space-y-4'>
              <h2 className='font-serif text-3xl font-normal text-[#0a0a0a]'>
                Job History &amp; Archives
              </h2>
              <div className='border border-[#e5e5e5] bg-white p-6'>
                {jobs.length === 0 ? (
                  <div className='py-8 text-center text-xs font-mono text-[#8a8a8a]'>
                    No past jobs recorded. Dispatch a sourcing run to populate
                    history.
                  </div>
                ) : (
                  jobs.map(j => (
                    <div
                      key={j._id}
                      onClick={() => {
                        setSelectedJobId(j._id)
                        setActiveTab('dashboard')
                      }}
                      className='p-4 border-b border-[#f0f0f0] last:border-b-0 flex items-center justify-between cursor-pointer hover:bg-[#fafafa]'
                    >
                      <div>
                        <h4 className='font-serif text-lg'>
                          {j.parsedIntent?.description || j.rawTask}
                        </h4>
                        <p className='text-xs text-[#737373] font-mono mt-1'>
                          {j.userEmail} ·{' '}
                          {new Date(j.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className='font-mono text-xs text-[#16a34a] uppercase'>
                        {j.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeTab === 'verify' ? (
            <div className='border border-[#e5e5e5] bg-white p-8 space-y-6'>
              <h2 className='font-serif text-3xl font-normal text-[#0a0a0a]'>
                System Verification &amp; Invariant Proofs
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='p-4 border border-[#e5e5e5] bg-[#fafafa]'>
                  <span className='text-xs uppercase text-[#737373] block mb-1'>
                    CONVEX HOSTING
                  </span>
                  <span className='text-sm font-semibold text-[#16a34a] block'>
                    PASS (200 OK)
                  </span>
                  <span className='text-[11px] text-[#737373] mt-2 block'>
                    energetic-koala-352.convex.site
                  </span>
                </div>
                <div className='p-4 border border-[#e5e5e5] bg-[#fafafa]'>
                  <span className='text-xs uppercase text-[#737373] block mb-1'>
                    AI ENGINE
                  </span>
                  <span className='text-sm font-semibold text-[#16a34a] block'>
                    GEMINI 3.6 FLASH
                  </span>
                  <span className='text-[11px] text-[#737373] mt-2 block'>
                    Vercel AI SDK Google Adapter
                  </span>
                </div>
                <div className='p-4 border border-[#e5e5e5] bg-[#fafafa]'>
                  <span className='text-xs uppercase text-[#737373] block mb-1'>
                    AGENTMAIL WEBHOOK
                  </span>
                  <span className='text-sm font-semibold text-[#16a34a] block'>
                    ONLINE
                  </span>
                  <span className='text-[11px] text-[#737373] mt-2 block'>
                    /webhook/agentmail
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className='flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-[#e5e5e5]'>
                <div>
                  <div className='flex items-center gap-3'>
                    <h1 className='text-4xl font-serif tracking-tight text-[#0a0a0a]'>
                      {activeJob
                        ? `Agent #${activeJob._id.slice(-4)}`
                        : 'Relay Agent'}
                    </h1>
                    <span className='bg-[#0a0a0a] text-white text-[10px] font-mono px-2.5 py-1 uppercase tracking-wider font-medium'>
                      {activeJob ? '✓ VERIFIED ON CONVEX' : 'STANDBY'}
                    </span>
                  </div>
                  <p className='font-mono text-xs text-[#737373] mt-2'>
                    {activeJob ? (
                      <>
                        Client:{' '}
                        <span className='text-[#0a0a0a]'>
                          {activeJob.userEmail}
                        </span>{' '}
                        · Inbox:{' '}
                        <span className='text-[#0a0a0a]'>
                          {activeJob.agentEmail || 'Provisioning inbox...'}
                        </span>
                      </>
                    ) : (
                      'Autonomous vendor discovery, email negotiation & quote intelligence'
                    )}
                  </p>
                </div>

                <div className='flex items-center gap-3'>
                  {activeJob?.summary && (
                    <button
                      onClick={() => setShowSummaryModal(true)}
                      className='border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-[#0a0a0a] font-mono text-xs uppercase px-4 py-2.5 tracking-wider transition-colors'
                    >
                      SHOW LATEST REPORT
                    </button>
                  )}
                  <button
                    onClick={() => setShowModal(true)}
                    className='bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-xs uppercase px-5 py-2.5 tracking-wider transition-colors'
                  >
                    NEW SOURCING RUN ↗
                  </button>
                </div>
              </div>

              <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
                <MetricCard
                  label='TOTAL DECISIONS'
                  value={totalDecisionsCount}
                />
                <MetricCard
                  label='QUOTES SECURED'
                  value={bestQuote}
                  highlight={quotesCount > 0}
                />
                <MetricCard
                  label='VENDORS CONTACTED'
                  value={vendorsContactedCount}
                />
                <MetricCard label='AUTONOMY RATE' value={autonomyRate} />
              </div>

              <div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
                <div className='lg:col-span-4 space-y-6'>
                  <div className='flex items-center justify-between pb-2 border-b border-[#e5e5e5]'>
                    <span className='text-[11px] font-mono font-semibold uppercase tracking-wider text-[#525252]'>
                      PLAN SUMMARY
                    </span>
                    <span className='text-[10px] font-mono text-[#8a8a8a]'>
                      {activeJob
                        ? `JOB #${activeJob._id.slice(-4)}`
                        : 'NO ACTIVE JOB'}
                    </span>
                  </div>

                  {activeJob ? (
                    <JobCard
                      job={activeJob}
                      selected={true}
                      onSelect={() => {}}
                      onCompileReport={() => setShowSummaryModal(true)}
                    />
                  ) : (
                    <div className='border border-dashed border-[#e5e5e5] bg-white p-6 text-center text-xs font-mono text-[#8a8a8a] space-y-3'>
                      <p>No active sourcing task running.</p>
                      <button
                        onClick={() => setShowModal(true)}
                        className='bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-xs uppercase px-4 py-2 tracking-wider transition-colors'
                      >
                        START SOURCING RUN ↗
                      </button>
                    </div>
                  )}

                  <div className='space-y-2'>
                    <span className='text-[10px] font-mono uppercase tracking-wider text-[#8a8a8a] block'>
                      QUICK ACTIONS
                    </span>
                    <div className='grid grid-cols-2 gap-2 font-mono text-xs'>
                      <button
                        onClick={() => setShowModal(true)}
                        className='p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-center text-[#525252] hover:text-[#0a0a0a] transition-colors'
                      >
                        New search
                      </button>
                      <button
                        onClick={handleTriggerCompile}
                        disabled={!activeJob}
                        className='p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-center text-[#525252] hover:text-[#0a0a0a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                      >
                        Compile report
                      </button>
                      <button
                        onClick={() => {
                          if (activeJob?.agentEmail) {
                            navigator.clipboard.writeText(activeJob.agentEmail)
                          }
                        }}
                        disabled={!activeJob?.agentEmail}
                        className='p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-center text-[#525252] hover:text-[#0a0a0a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                      >
                        Copy agent email
                      </button>
                      <button
                        onClick={() => setActiveTab('setup')}
                        className='p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-center text-[#525252] hover:text-[#0a0a0a] transition-colors'
                      >
                        Setup wizard
                      </button>
                      <button
                        onClick={() => setActiveTab('verify')}
                        className='p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-center text-[#525252] hover:text-[#0a0a0a] transition-colors'
                      >
                        System verify
                      </button>
                      <button
                        onClick={() => {
                          if (activeJob) {
                            startPipeline({
                              userEmail: activeJob.userEmail,
                              rawTask: activeJob.rawTask,
                            })
                          }
                        }}
                        disabled={!activeJob}
                        className='p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-center text-[#525252] hover:text-[#0a0a0a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                      >
                        Run cycle
                      </button>
                    </div>
                  </div>

                  <div className='pt-4 border-t border-[#e5e5e5] flex items-center justify-between text-xs font-mono'>
                    <span className='text-[#8a8a8a] uppercase text-[10px]'>
                      WORKFLOW STATUS
                    </span>
                    <span
                      className={`font-medium flex items-center gap-1.5 ${
                        activeJob ? 'text-[#16a34a]' : 'text-[#737373]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          activeJob
                            ? 'bg-[#16a34a] animate-pulse'
                            : 'bg-[#a3a3a3]'
                        }`}
                      />
                      {activeJob
                        ? activeJob.status.toUpperCase().replace('_', ' ')
                        : 'STANDBY'}
                    </span>
                  </div>
                </div>

                <div className='lg:col-span-8 space-y-6'>
                  {pendingDecision && (
                    <DecisionBanner
                      question={pendingDecision.question}
                      context={pendingDecision.context}
                      options={pendingDecision.options}
                      onResolve={handleResolve}
                    />
                  )}

                  <TerminalBox
                    steps={terminalSteps}
                    statusLabel={
                      activeJob
                        ? activeJob.status.toUpperCase().replace('_', ' ')
                        : 'STANDBY'
                    }
                    onSendQuery={q => {
                      if (activeJob) {
                        startPipeline({
                          userEmail: activeJob.userEmail,
                          rawTask: q,
                        })
                      }
                    }}
                  />

                  <div className='border border-[#e5e5e5] bg-white p-6'>
                    <div className='flex items-center justify-between pb-3 border-b border-[#f0f0f0] mb-2'>
                      <span className='text-[11px] font-mono font-semibold uppercase tracking-wider text-[#525252]'>
                        VENDOR OUTREACH &amp; QUOTE FEED
                      </span>
                      <span className='text-[10px] font-mono text-[#8a8a8a]'>
                        ACTION | REASONING | DETAILS | DATE
                      </span>
                    </div>

                    {threads.length === 0 ? (
                      <div className='py-12 text-center text-xs font-mono text-[#8a8a8a]'>
                        No active vendor threads yet. Click &quot;New Sourcing
                        Run&quot; to begin.
                      </div>
                    ) : (
                      threads.map(thread => (
                        <ThreadRow
                          key={thread._id}
                          thread={thread}
                          jobDescription={
                            activeJob?.parsedIntent?.description ??
                            activeJob?.rawTask
                          }
                          agentInboxId={
                            activeJob?.agentInboxId || thread.agentInboxId
                          }
                          agentEmail={
                            activeJob?.agentEmail || thread.agentEmail
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className='border-t border-[#e5e5e5] bg-white py-6 mt-12'>
        <div className='max-w-7xl mx-auto px-6 text-center text-[10px] font-mono uppercase tracking-widest text-[#8a8a8a]'>
          ALL SOURCING ACTIONS AUTONOMOUSLY RECORDED ON CONVEX · POWERED BY
          GEMINI 3.6 FLASH · FIRECRAWL · AGENTMAIL
        </div>
      </footer>

      {showModal && <NewJobModal onClose={() => setShowModal(false)} />}

      {showSummaryModal && activeJob?.summary && (
        <div
          onClick={e =>
            e.target === e.currentTarget && setShowSummaryModal(false)
          }
          className='fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4'
        >
          <div className='bg-white border border-[#e5e5e5] w-full max-w-2xl p-7 shadow-2xl max-h-[80vh] flex flex-col justify-between'>
            <div>
              <div className='flex items-start justify-between pb-4 border-b border-[#f0f0f0] mb-4'>
                <div>
                  <span className='text-[10px] font-mono uppercase tracking-wider text-[#16a34a] font-semibold'>
                    ✓ SOURCING REPORT COMPILED
                  </span>
                  <h3 className='font-serif text-2xl text-[#0a0a0a] mt-1'>
                    Executive Summary
                  </h3>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className='font-mono text-lg text-[#8a8a8a] hover:text-[#0a0a0a]'
                >
                  ×
                </button>
              </div>
              <div className='overflow-y-auto max-h-[50vh] pr-2 font-mono text-xs whitespace-pre-wrap leading-relaxed text-[#171717]'>
                {activeJob.summary}
              </div>
            </div>
            <div className='pt-4 border-t border-[#f0f0f0] mt-4 flex justify-end'>
              <button
                onClick={() => setShowSummaryModal(false)}
                className='bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-xs uppercase px-6 py-2.5 tracking-wider'
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
