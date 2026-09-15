import { DashboardView } from '../components/dashboard-view'

type JobsPageProps = {
  searchParams: Promise<{
    tab?: 'dashboard' | 'setup' | 'history'
    email?: string
    job?: string
  }>
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = await searchParams
  return (
    <DashboardView
      initialTab={params.tab || 'dashboard'}
      initialJobId={params.job}
    />
  )
}
