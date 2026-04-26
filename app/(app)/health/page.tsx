import { auth } from '@clerk/nextjs/server'
import { runHealthChecks } from '@/lib/health/checks'
import { HealthClient } from './health-client'

export const dynamic = 'force-dynamic'

export default async function HealthPage() {
  const { userId } = await auth()
  if (!userId) return null
  const report = await runHealthChecks()
  return <HealthClient initialReport={report} />
}
