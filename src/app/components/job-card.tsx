'use client'

import { Id } from '@/convex/_generated/dataModel'
import { useSyncExternalStore } from 'react'

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

type JobCardProps = {
  job: JobDoc
  selected: boolean
  onSelect: () => void
  onCompileReport: () => void
}

const subscribeMinute = (callback: () => void) => {
  const interval = setInterval(callback, 60000)
  return () => clearInterval(interval)
}
const getNow = () => Date.now()
const getServerSnapshot = () => 0

const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  const sliced =
    local.length > 4
      ? `${local.slice(0, 3)}...${local.slice(-2)}`
      : `${local.slice(0, 1)}...`
  return `${sliced}@${domain}`
}

export default function JobCard({
  job,
  selected,
  onSelect,
  onCompileReport,
}: JobCardProps) {
  const now = useSyncExternalStore(subscribeMinute, getNow, getServerSnapshot)
  const elapsed =
    now > 0 ? Math.max(0, Math.round((now - job.createdAt) / 60000)) : 0

  const getStatusBadge = () => {
    switch (job.status) {
      case 'completed':
        return {
          text: 'COMPLETED',
          color: 'text-[#16a34a]',
          bg: 'bg-[#ecfdf5]',
          dot: 'bg-[#16a34a]',
        }
      case 'needs_decision':
        return {
          text: 'INPUT REQ',
          color: 'text-[#d97706]',
          bg: 'bg-[#fffbeb]',
          dot: 'bg-[#d97706]',
        }
      case 'failed':
        return {
          text: 'FAILED',
          color: 'text-[#dc2626]',
          bg: 'bg-[#fef2f2]',
          dot: 'bg-[#dc2626]',
        }
      default:
        return {
          text: 'ACTIVE',
          color: 'text-[#16a34a]',
          bg: 'bg-[#ecfdf5]',
          dot: 'bg-[#16a34a]',
        }
    }
  }

  const badge = getStatusBadge()

  return (
    <div
      onClick={onSelect}
      className={`border transition-all cursor-pointer p-5 bg-white mb-4 ${
        selected
          ? 'border-[#0a0a0a] shadow-sm'
          : 'border-[#e5e5e5] hover:border-[#a3a3a3]'
      }`}
    >
      <div className='flex items-center justify-between gap-2 mb-3'>
        <span className='font-mono text-[10px] text-[#737373]'>
          {maskEmail(job.userEmail)}
        </span>
        <span
          className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 border border-[#e5e5e5] uppercase ${badge.bg} ${badge.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          {badge.text}
        </span>
      </div>

      <h4 className='font-serif text-lg font-normal text-[#0a0a0a] leading-snug line-clamp-2 mb-4'>
        {job.parsedIntent?.description || job.rawTask}
      </h4>

      <div className='space-y-1.5 font-mono text-[11px] text-[#525252] border-t border-[#f0f0f0] pt-3'>
        <div className='flex justify-between'>
          <span className='text-[#8a8a8a]'>Category:</span>
          <span className='text-[#0a0a0a] font-medium'>
            {job.parsedIntent?.category || 'Services'}
          </span>
        </div>
        <div className='flex justify-between'>
          <span className='text-[#8a8a8a]'>Location:</span>
          <span className='text-[#0a0a0a]'>
            {job.parsedIntent?.location || 'Remote / Area'}
          </span>
        </div>
        <div className='flex justify-between'>
          <span className='text-[#8a8a8a]'>Budget:</span>
          <span className='text-[#0a0a0a]'>
            {job.parsedIntent?.budget || 'Flexible'}
          </span>
        </div>
        <div className='flex justify-between'>
          <span className='text-[#8a8a8a]'>Created:</span>
          <span className='text-[#737373]'>
            {elapsed < 1 ? 'just now' : `${elapsed}m ago`}
          </span>
        </div>
      </div>

      {job.status === 'completed' && job.summary && (
        <div className='mt-4 pt-3 border-t border-[#f0f0f0]'>
          <button
            onClick={e => {
              e.stopPropagation()
              onCompileReport()
            }}
            className='w-full bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-[11px] py-2 uppercase tracking-wider'
          >
            VIEW FINAL REPORT →
          </button>
        </div>
      )}
    </div>
  )
}
