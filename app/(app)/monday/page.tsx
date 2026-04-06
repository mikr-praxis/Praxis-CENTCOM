import { MondayClient } from './monday-client'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function MondayPage() {
  await requireRole('/monday')
  return <MondayClient />
}
