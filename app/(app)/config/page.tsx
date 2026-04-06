import { ConfigClient } from './config-client'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ConfigPage() {
  await requireRole('/config')
  return <ConfigClient />
}
