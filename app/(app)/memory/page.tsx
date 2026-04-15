import { requireRole } from '@/lib/auth'
import { loadMemories } from '@/lib/memory/loader'
import { MemoryClient } from './memory-client'

export const dynamic = 'force-dynamic'

export default async function MemoryPage() {
  await requireRole('/memory')
  const entries = await loadMemories()
  return <MemoryClient entries={entries} />
}
