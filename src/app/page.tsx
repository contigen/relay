'use client'

import { useState } from 'react'
import Link from 'next/link'
import NewJobModal from './components/new-job-modal'

const EXAMPLES = [
  {
    title: 'Office Cleaning',
    task: 'Find 3 commercial cleaning services in Austin for weekly service under $500/month',
  },
  {
    title: 'Event Catering',
    task: 'Get quotes from 3 caterers in NYC for a 40-person team lunch on Oct 20, budget $1,200',
  },
  {
    title: 'Commercial Photography',
    task: 'Source 3 commercial photographers in Seattle for product shoots, budget $800',
  },
  {
    title: 'Equipment Rental',
    task: 'Compare 3 audio-visual rental companies in Chicago for a 2-day conference',
  },
]

export default function HomePage() {
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyEmail = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText('re-lay@agentmail.to')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className='min-h-screen bg-[#fafafa] text-[#0a0a0a] flex flex-col justify-between font-mono'>
      <div>
        <header className='border-b border-[#e5e5e5] bg-white sticky top-0 z-40'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2'>
            <div className='flex items-center gap-2 shrink-0'>
              <span className='w-2 h-2 rounded-full bg-[#16a34a] animate-pulse' />
              <span className='font-mono font-bold text-xs tracking-widest uppercase text-[#0a0a0a]'>
                RELAY
              </span>
            </div>

            <nav className='hidden md:flex items-center gap-8 text-xs uppercase tracking-wider text-[#737373]'>
              <a
                href='#how-it-works'
                className='hover:text-[#0a0a0a] transition-colors'
              >
                HOW IT WORKS
              </a>
              <a
                href='#examples'
                className='hover:text-[#0a0a0a] transition-colors'
              >
                EXAMPLES
              </a>
              <Link
                href='/jobs'
                className='hover:text-[#0a0a0a] transition-colors'
              >
                LIVE DASHBOARD
              </Link>
            </nav>

            <div className='flex items-center gap-2 sm:gap-3 shrink-0'>
              <Link
                href='/jobs'
                className='border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-[#0a0a0a] text-[10px] sm:text-[11px] font-mono uppercase px-2.5 sm:px-3 py-1.5 tracking-wider transition-colors'
              >
                DASHBOARD
              </Link>
              <button
                type='button'
                onClick={() => setShowModal(true)}
                className='bg-[#0a0a0a] hover:bg-[#262626] text-white text-[10px] sm:text-[11px] font-mono uppercase px-2.5 sm:px-3.5 py-1.5 tracking-wider transition-colors whitespace-nowrap'
              >
                <span className='hidden sm:inline'>START A SEARCH →</span>
                <span className='sm:hidden'>START →</span>
              </button>
            </div>
          </div>
        </header>

        <main className='max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24 space-y-24'>
          <section className='space-y-8 max-w-3xl'>
            <div className='inline-flex items-center gap-2 border border-[#e5e5e5] bg-white px-3 py-1 text-[11px] text-[#737373]'>
              <span className='w-1.5 h-1.5 rounded-full bg-[#16a34a]' />
              <span>AI VENDOR SOURCING BY EMAIL</span>
            </div>

            <h1 className='text-3xl sm:text-5xl md:text-7xl font-serif tracking-tight font-normal text-[#0a0a0a] leading-[1.08]'>
              Get quotes from local vendors without making a single call.
            </h1>

            <p className='text-base md:text-lg font-mono text-[#525252] leading-relaxed max-w-2xl'>
              Send an email with what you need. Relay finds the best local
              businesses, reaches out on your behalf, negotiates pricing, and
              emails you a comparative report with the best quotes.
            </p>

            <div className='p-6 border border-[#e5e5e5] bg-white max-w-2xl space-y-4 shadow-sm'>
              <div className='flex items-center justify-between text-xs text-[#737373]'>
                <span className='uppercase tracking-wider font-semibold text-[#0a0a0a]'>
                  TO START, SEND AN EMAIL TO:
                </span>
                <span>NO SIGN UP REQUIRED</span>
              </div>

              <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-[#fafafa] border border-[#e5e5e5]'>
                <code className='text-base text-[#0a0a0a] font-bold tracking-wide select-all'>
                  re-lay@agentmail.to
                </code>
                <button
                  type='button'
                  onClick={handleCopyEmail}
                  className='bg-white hover:bg-[#f0f0f0] border border-[#e5e5e5] text-[#0a0a0a] text-[11px] px-3.5 py-2 uppercase tracking-wider font-medium transition-colors'
                >
                  {copied ? 'COPIED ✓' : 'COPY EMAIL'}
                </button>
              </div>

              <p className='text-xs text-[#737373] leading-relaxed'>
                Describe what you are looking for—like cleaning services,
                caterers, photographers, or contractors. Relay takes care of the
                search, outreach, and follow-ups.
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-4 pt-2'>
              <button
                type='button'
                onClick={() => setShowModal(true)}
                className='bg-[#0a0a0a] hover:bg-[#262626] text-white text-xs uppercase tracking-wider px-6 py-3.5 transition-colors'
              >
                START SOURCING IN BROWSER →
              </button>
              <Link
                href='/jobs'
                className='border border-[#0a0a0a] hover:bg-[#f0f0f0] text-[#0a0a0a] text-xs uppercase tracking-wider px-6 py-3.5 transition-colors'
              >
                VIEW LIVE DASHBOARD
              </Link>
            </div>
          </section>

          <section
            id='how-it-works'
            className='space-y-10 pt-8 border-t border-[#e5e5e5]'
          >
            <div>
              <span className='text-[11px] font-mono text-[#16a34a] uppercase tracking-wider font-semibold'>
                SIMPLE WORKFLOW
              </span>
              <h2 className='text-3xl md:text-4xl font-serif font-normal text-[#0a0a0a] mt-2'>
                How Relay works
              </h2>
              <p className='text-xs text-[#737373] mt-2 max-w-xl'>
                You manage everything from your inbox. No new apps to learn, no
                forms to fill out repeatedly.
              </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <div className='border border-[#e5e5e5] bg-white p-6 space-y-3'>
                <div className='text-[10px] text-[#8a8a8a] uppercase tracking-widest'>
                  STEP 01
                </div>
                <h3 className='font-serif text-xl text-[#0a0a0a]'>
                  Send an email
                </h3>
                <p className='text-xs text-[#525252] leading-relaxed'>
                  Write to{' '}
                  <code className='text-[#0a0a0a]'>re-lay@agentmail.to</code>{' '}
                  with your request: what service you need, your location,
                  deadline, and budget target.
                </p>
              </div>

              <div className='border border-[#e5e5e5] bg-white p-6 space-y-3'>
                <div className='text-[10px] text-[#8a8a8a] uppercase tracking-widest'>
                  STEP 02
                </div>
                <h3 className='font-serif text-xl text-[#0a0a0a]'>
                  Relay contacts vendors
                </h3>
                <p className='text-xs text-[#525252] leading-relaxed'>
                  Relay finds verified local providers, sends customized quote
                  inquiries, and follows up to make sure you get clear pricing.
                </p>
              </div>

              <div className='border border-[#e5e5e5] bg-white p-6 space-y-3'>
                <div className='text-[10px] text-[#8a8a8a] uppercase tracking-widest'>
                  STEP 03
                </div>
                <h3 className='font-serif text-xl text-[#0a0a0a]'>
                  Compare &amp; choose
                </h3>
                <p className='text-xs text-[#525252] leading-relaxed'>
                  You receive an executive summary in your inbox with a
                  side-by-side pricing table and recommendations. You pick the
                  winner.
                </p>
              </div>
            </div>
          </section>

          <section
            id='examples'
            className='space-y-8 pt-8 border-t border-[#e5e5e5]'
          >
            <div>
              <span className='text-[11px] font-mono text-[#737373] uppercase tracking-wider font-semibold'>
                WHAT YOU CAN SOURCE
              </span>
              <h2 className='text-3xl font-serif font-normal text-[#0a0a0a] mt-2'>
                Common requests Relay handles
              </h2>
              <p className='text-xs text-[#737373] mt-2'>
                Click any example to launch a search right away:
              </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {EXAMPLES.map(ex => (
                <div
                  key={ex.title}
                  onClick={() => setShowModal(true)}
                  className='p-5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] transition-colors cursor-pointer group space-y-2'
                >
                  <div className='flex items-center justify-between'>
                    <span className='text-xs font-semibold uppercase tracking-wider text-[#0a0a0a]'>
                      {ex.title}
                    </span>
                    <span className='text-[10px] text-[#737373] group-hover:text-[#0a0a0a] transition-colors'>
                      TRY THIS →
                    </span>
                  </div>
                  <p className='text-xs text-[#525252] leading-relaxed font-mono'>
                    &quot;{ex.task}&quot;
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      <footer className='border-t border-[#e5e5e5] bg-white py-6 mt-16'>
        <div className='max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-widest text-[#8a8a8a]'>
          <div>RELAY · SOURCING AUTOMATION FOR TEAMS AND BUSINESSES</div>
          <div className='flex items-center gap-6'>
            <Link
              href='/jobs'
              className='hover:text-[#0a0a0a] transition-colors'
            >
              DASHBOARD
            </Link>
            <a
              href='mailto:re-lay@agentmail.to'
              className='hover:text-[#0a0a0a] transition-colors'
            >
              EMAIL RELAY
            </a>
          </div>
        </div>
      </footer>

      {showModal && <NewJobModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
