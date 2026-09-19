'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DashboardView } from '@/app/components/dashboard-view'

function JobsContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab =
    tabParam === 'setup' || tabParam === 'history' ? tabParam : 'dashboard'
  const job = searchParams.get('job') ?? undefined

  return <DashboardView initialTab={tab} initialJobId={job} />
}

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsContent />
    </Suspense>
  )
}
