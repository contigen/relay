'use client'

import { useState } from 'react'

type TerminalStep = {
  text: string
  status: 'done' | 'running' | 'pending'
}

type TerminalBoxProps = {
  steps: TerminalStep[]
  statusLabel?: string
  onSendQuery?: (query: string) => void
}

export default function TerminalBox({
  steps,
  statusLabel = 'LIVE PIPELINE',
  onSendQuery,
}: TerminalBoxProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || !onSendQuery) return
    onSendQuery(prompt)
    setPrompt('')
  }

  return (
    <div className='border border-[#e5e5e5] bg-white p-6 mb-6'>
      <div className='flex items-center justify-between pb-4 border-b border-[#f0f0f0] mb-4'>
        <span className='text-[11px] font-mono font-semibold uppercase tracking-wider text-[#525252]'>
          CYCLE EXECUTION
        </span>
        <span className='flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#2563eb]'>
          <span className='w-2 h-2 rounded-full bg-[#2563eb] animate-pulse' />
          {statusLabel}
        </span>
      </div>

      <div className='space-y-2.5 font-mono text-xs mb-6'>
        {steps.map((step, idx) => (
          <div key={idx} className='flex items-start gap-2.5'>
            {step.status === 'done' && (
              <span className='text-[#16a34a] font-bold select-none'>✓</span>
            )}
            {step.status === 'running' && (
              <span className='text-[#2563eb] font-bold select-none animate-spin'>
                ●
              </span>
            )}
            {step.status === 'pending' && (
              <span className='text-[#a3a3a3] font-bold select-none'>○</span>
            )}
            <span
              className={
                step.status === 'done'
                  ? 'text-[#171717]'
                  : step.status === 'running'
                    ? 'text-[#2563eb]'
                    : 'text-[#a3a3a3]'
              }
            >
              {step.text}
            </span>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className='flex items-center gap-2 pt-2 border-t border-[#f0f0f0]'
      >
        <input
          type='text'
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder='Start a new sourcing task (e.g. Find 3 caterers in NYC under $1,200)...'
          className='flex-1 bg-[#fafafa] border border-[#e5e5e5] px-3.5 py-2 text-xs font-mono text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:bg-white'
        />
        <button
          type='submit'
          disabled={!prompt.trim()}
          className='bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-xs px-5 py-2 uppercase tracking-wider disabled:opacity-40 transition-colors'
        >
          DISPATCH
        </button>
      </form>
    </div>
  )
}
