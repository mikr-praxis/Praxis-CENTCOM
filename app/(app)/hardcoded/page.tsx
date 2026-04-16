import { requireRole } from '@/lib/auth'
import { HardcodedValuesClient } from './hardcoded-client'

export const dynamic = 'force-dynamic'

export default async function HardcodedValuesPage() {
  await requireRole('/hardcoded')
  return <HardcodedValuesClient />
}
