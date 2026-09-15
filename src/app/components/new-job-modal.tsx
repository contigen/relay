'use client'

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'

type NewJobModalProps = {
  onClose: () => void
}

const EXAMPLES = [
  'Find me 3 office cleaning services in Austin, weekly contract, roughly 2,000 sqft, under $500/month',
  'Get quotes from 3 caterers in NYC for a 40-person lunch on Oct 20, budget $1,200',
  'Source 3 freelance commercial photographers in Seattle, budget $800, needed by end of month',
]

export default function NewJobModal({ onClose }: NewJobModalProps) {
  const [email, setEmail] = useState('')
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const startPipeline = useAction(api.agent.startPipeline)

  const handleSubmit = async () => {
    if (!email.trim() || !task.trim() || loading) return
    setLoading(true)

    try {
      await startPipeline({ userEmail: email, rawTask: task })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      className='fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4'
    >
      <div className='bg-white border border-[#e5e5e5] w-full max-w-lg p-7 shadow-2xl'>
        <div className='flex items-start justify-between pb-4 border-b border-[#f0f0f0] mb-5'>
          <div>
            <h3 className='font-serif text-2xl font-normal text-[#0a0a0a]'>
              New Sourcing Run
            </h3>
            <p className='font-mono text-xs text-[#737373] mt-1'>
              Autonomous multi-vendor discovery, outreach, and quote collation
            </p>
          </div>
          <button
            onClick={onClose}
            className='text-lg text-[#8a8a8a] hover:text-[#0a0a0a] font-mono leading-none'
          >
            ×
          </button>
        </div>

        <div className='space-y-4 font-mono text-xs'>
          <div>
            <label className='block uppercase tracking-wider text-[11px] font-semibold text-[#525252] mb-1.5'>
              Client Email Address
            </label>
            <input
              type='email'
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='you@company.com'
              className='w-full border border-[#e5e5e5] px-3.5 py-2.5 bg-[#fafafa] focus:bg-white text-[#0a0a0a] outline-none focus:border-[#0a0a0a]'
            />
          </div>

          <div>
            <label className='block uppercase tracking-wider text-[11px] font-semibold text-[#525252] mb-1.5'>
              Task Specification
            </label>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder='Describe requirements: service type, region, headcount or scale, and budget ceiling...'
              rows={4}
              className='w-full border border-[#e5e5e5] px-3.5 py-2.5 bg-[#fafafa] focus:bg-white text-[#0a0a0a] outline-none focus:border-[#0a0a0a] resize-none leading-relaxed'
            />
          </div>

          <div>
            <span className='block text-[10px] uppercase tracking-wider text-[#8a8a8a] mb-2'>
              Presets
            </span>
            <div className='space-y-1.5'>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type='button'
                  onClick={() => setTask(ex)}
                  className={`w-full text-left p-2 border text-[11px] font-mono transition-colors ${
                    task === ex
                      ? 'border-[#0a0a0a] bg-[#fafafa] text-[#0a0a0a]'
                      : 'border-[#e5e5e5] bg-white hover:border-[#a3a3a3] text-[#737373]'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !email.trim() || !task.trim()}
            className='w-full mt-2 bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-xs uppercase tracking-wider py-3 disabled:opacity-40 transition-colors'
          >
            {loading ? 'INITIALIZING PIPELINE…' : 'DISPATCH SOURCING RUN →'}
          </button>
        </div>
      </div>
    </div>
  )
}
