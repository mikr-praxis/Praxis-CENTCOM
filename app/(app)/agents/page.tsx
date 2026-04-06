import { AgentsClient } from './agents-client'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  await requireRole('/agents')
  return <AgentsClient />
}
