'use client'

import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useState } from 'react'
import Link from 'next/link'
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
  initialTab?: 'dashboard' | 'setup' | 'history'
  initialJobId?: string
}

const maskEmail = (email?: string): string => {
  if (!email || !email.includes('@')) return email ?? '—'
  const [local, domain] = email.split('@')
  const sliced =
    local.length > 4
      ? `${local.slice(0, 3)}...${local.slice(-2)}`
      : `${local.slice(0, 1)}...`
  return `${sliced}@${domain}`
}

export function DashboardView({
  initialTab = 'dashboard',
  initialJobId,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'setup' | 'history'>(
    initialTab,
  )

  const scopedJobId = (initialJobId ||
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('job')
      : null)) as Id<'jobs'> | null

  const [selectedJobId, setSelectedJobId] = useState<Id<'jobs'> | null>(
    scopedJobId,
  )
  const [showModal, setShowModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [userEmail, setUserEmail] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('email') || localStorage.getItem('relay_user_email') || ''
  })
  const [emailInput, setEmailInput] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    const params = new URLSearchParams(window.location.search)
    return params.get('email') || localStorage.getItem('relay_user_email') || ''
  })
  const [isEditingEmail, setIsEditingEmail] = useState(false)

  const handleUpdateEmail = (newEmail: string) => {
    const trimmed = newEmail.trim().toLowerCase()
    setUserEmail(trimmed)
    setIsEditingEmail(false)
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('relay_user_email', trimmed)
        const url = new URL(window.location.href)
        url.searchParams.set('email', trimmed)
        window.history.replaceState({}, '', url.toString())
      } else {
        localStorage.removeItem('relay_user_email')
        const url = new URL(window.location.href)
        url.searchParams.delete('email')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }

  const directJob = useQuery(
    api.jobs.getJob,
    scopedJobId ? { jobId: scopedJobId } : 'skip',
  ) as JobDoc | null | undefined

  const jobs = (useQuery(
    api.jobs.listJobs,
    scopedJobId ? 'skip' : userEmail ? { userEmail } : {},
  ) ?? []) as JobDoc[]

  const activeJob =
    directJob ??
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
  const syncInboxMessages = useAction(api.agent.syncInboxMessages)

  const handleSyncMessages = async () => {
    if (!activeJob) return
    setIsSyncing(true)
    try {
      await syncInboxMessages({ jobId: activeJob._id })
    } catch (err) {
      console.error('Failed to sync inbox messages:', err)
    } finally {
      setIsSyncing(false)
    }
  }

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

  const jobIndex = activeJob
    ? Math.max(1, jobs.length - jobs.findIndex(j => j._id === activeJob._id))
    : 1
  const agentNumber = scopedJobId
    ? scopedJobId.slice(-4).toUpperCase()
    : String(jobIndex).padStart(2, '0')
  const agentTitle = activeJob ? `Agent #${agentNumber}` : 'Relay Agent'

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
          <div className='max-w-7xl mx-auto px-3 sm:px-6'>
            <div className='h-14 flex items-center justify-between gap-2'>
              <Link
                href='/'
                className='flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity'
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeJob ? 'bg-[#16a34a] animate-pulse' : 'bg-[#a3a3a3]'
                  }`}
                />
                <span className='font-mono font-bold text-xs tracking-widest uppercase text-[#0a0a0a]'>
                  RELAY
                </span>
              </Link>

              <nav className='hidden md:flex items-center gap-8'>
                {(['dashboard', 'setup', 'history'] as const).map(tab => (
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
                ))}
              </nav>

              <div className='flex items-center gap-1.5 sm:gap-3 shrink-0'>
                {scopedJobId ? (
                  <div className='flex items-center gap-1.5 sm:gap-2'>
                    <div className='flex items-center gap-1 sm:gap-1.5 border border-[#e5e5e5] px-2 sm:px-2.5 py-1 bg-white'>
                      <span className='text-[9px] uppercase tracking-wider text-[#8a8a8a] hidden sm:inline'>
                        RUN:
                      </span>
                      <span className='text-[10px] sm:text-[11px] font-mono text-[#0a0a0a] font-medium'>
                        #{scopedJobId.slice(-4).toUpperCase()}
                      </span>
                    </div>
                    <Link
                      href='/jobs'
                      className='text-[9px] sm:text-[10px] text-[#737373] hover:text-[#0a0a0a] uppercase tracking-wider whitespace-nowrap'
                      title='View all runs'
                    >
                      <span className='hidden sm:inline'>ALL RUNS →</span>
                      <span className='sm:hidden'>ALL →</span>
                    </Link>
                  </div>
                ) : isEditingEmail ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      handleUpdateEmail(emailInput)
                    }}
                    className='flex items-center gap-1'
                  >
                    <input
                      type='email'
                      placeholder='your@email.com'
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      className='border border-[#0a0a0a] px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-mono outline-none w-28 sm:w-44'
                      autoFocus
                    />
                    <button
                      type='submit'
                      className='bg-[#0a0a0a] text-white text-[9px] sm:text-[10px] font-mono uppercase px-1.5 sm:px-2 py-1'
                    >
                      Set
                    </button>
                    <button
                      type='button'
                      onClick={() => setIsEditingEmail(false)}
                      className='text-[10px] sm:text-[11px] text-[#737373] hover:text-[#0a0a0a] px-1'
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <button
                    type='button'
                    onClick={() => setIsEditingEmail(true)}
                    className='text-[10px] sm:text-[11px] font-mono text-[#737373] hover:text-[#0a0a0a] flex items-center gap-1 sm:gap-1.5 border border-[#e5e5e5] px-2 py-1 bg-white hover:border-[#0a0a0a] transition-colors max-w-[130px] sm:max-w-none'
                    title='Scope dashboard to your email'
                  >
                    <span className='text-[9px] uppercase tracking-wider text-[#8a8a8a] hidden sm:inline'>
                      SCOPE:
                    </span>
                    <span className='text-[#0a0a0a] font-medium truncate'>
                      {userEmail ? maskEmail(userEmail) : 'GLOBAL'}
                    </span>
                    <span className='text-[9px] text-[#8a8a8a]'>✎</span>
                  </button>
                )}
                <span
                  className={`border border-[#e5e5e5] bg-[#fafafa] text-[9px] sm:text-[10px] font-mono uppercase px-2 sm:px-2.5 py-1 flex items-center gap-1.5 font-medium whitespace-nowrap ${
                    activeJob ? 'text-[#16a34a]' : 'text-[#737373]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      activeJob ? 'bg-[#16a34a] animate-pulse' : 'bg-[#a3a3a3]'
                    }`}
                  />
                  <span className='hidden sm:inline'>
                    {activeJob ? 'AGENT ACTIVE' : 'STANDBY'}
                  </span>
                  <span className='sm:hidden'>
                    {activeJob ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </span>
              </div>
            </div>

            <nav className='flex md:hidden items-center border-t border-[#f0f0f0] -mx-3 px-3 bg-white'>
              {(['dashboard', 'setup', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 font-mono text-[11px] uppercase tracking-wider py-2.5 text-center border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-[#0a0a0a] text-[#0a0a0a] font-semibold bg-[#fafafa]'
                      : 'border-transparent text-[#737373] hover:text-[#0a0a0a]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className='max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8'>
          {activeTab === 'setup' ? (
            <SetupView
              onPlanCreated={() => setActiveTab('dashboard')}
              initialEmail={userEmail}
              onSuccess={email => handleUpdateEmail(email)}
            />
          ) : activeTab === 'history' ? (
            <div className='space-y-4'>
              <h2 className='font-serif text-2xl sm:text-3xl font-normal text-[#0a0a0a]'>
                Job History &amp; Archives
              </h2>
              <div className='border border-[#e5e5e5] bg-white p-4 sm:p-6'>
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
                        <h4 className='font-serif text-base sm:text-lg'>
                          {j.parsedIntent?.description || j.rawTask}
                        </h4>
                        <p className='text-xs text-[#737373] font-mono mt-1'>
                          {maskEmail(j.userEmail)} ·{' '}
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
          ) : (
            <>
              <div className='flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-[#e5e5e5]'>
                <div>
                  <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
                    <h1 className='text-2xl sm:text-4xl font-serif tracking-tight text-[#0a0a0a]'>
                      {agentTitle}
                    </h1>
                    <span className='bg-[#0a0a0a] text-white text-[9px] sm:text-[10px] font-mono px-2 sm:px-2.5 py-1 uppercase tracking-wider font-medium'>
                      {activeJob ? '✓ VERIFIED ON CONVEX' : 'STANDBY'}
                    </span>
                  </div>
                  <p className='font-mono text-xs text-[#737373] mt-2 break-all sm:break-normal'>
                    {activeJob ? (
                      <>
                        Client:{' '}
                        <span className='text-[#0a0a0a]'>
                          {maskEmail(activeJob.userEmail)}
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

                <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
                  {activeJob && (
                    <button
                      onClick={handleSyncMessages}
                      disabled={isSyncing}
                      className='border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-[#0a0a0a] font-mono text-[11px] sm:text-xs uppercase px-3 sm:px-4 py-2 sm:py-2.5 tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50'
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                        />
                      </svg>
                      {isSyncing ? 'CHECKING...' : 'SYNC REPLIES'}
                    </button>
                  )}
                  {activeJob?.summary && (
                    <button
                      onClick={() => setShowSummaryModal(true)}
                      className='border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-[#0a0a0a] font-mono text-[11px] sm:text-xs uppercase px-3 sm:px-4 py-2 sm:py-2.5 tracking-wider transition-colors'
                    >
                      SHOW LATEST REPORT
                    </button>
                  )}
                  <button
                    onClick={() => setShowModal(true)}
                    className='bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-[11px] sm:text-xs uppercase px-4 sm:px-5 py-2 sm:py-2.5 tracking-wider transition-colors'
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
                      {activeJob ? `RUN #${agentNumber}` : 'NO ACTIVE JOB'}
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
                        onClick={handleSyncMessages}
                        disabled={!activeJob || isSyncing}
                        className='p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-center text-[#525252] hover:text-[#0a0a0a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                      >
                        {isSyncing ? 'Syncing...' : 'Sync replies'}
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
                      if (!activeJob) return
                      const isQuestion =
                        /\b(update|status|progress|quote|how many|what|when|where|who)\b/i.test(
                          q,
                        ) || q.trim().endsWith('?')
                      if (isQuestion) {
                        handleSyncMessages()
                        handleTriggerCompile()
                        return
                      }
                      startPipeline({
                        userEmail: activeJob.userEmail,
                        rawTask: q,
                      })
                    }}
                  />

                  <div className='border border-[#e5e5e5] bg-white p-4 sm:p-6'>
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#f0f0f0] mb-2 gap-1'>
                      <span className='text-[11px] font-mono font-semibold uppercase tracking-wider text-[#525252]'>
                        VENDOR OUTREACH &amp; QUOTE FEED
                      </span>
                      <span className='text-[10px] font-mono text-[#8a8a8a] hidden sm:inline'>
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

      {showModal && (
        <NewJobModal
          onClose={() => setShowModal(false)}
          initialEmail={userEmail}
          onSuccess={email => handleUpdateEmail(email)}
        />
      )}

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
