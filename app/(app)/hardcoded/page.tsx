import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { HardcodedValuesClient } from './hardcoded-client'

export const dynamic = 'force-dynamic'

export default async function HardcodedValuesPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()
  const { data } = await supabase.from('app_config').select('key, value, updated_at')

  const configMap: Record<string, { value: string; updated_at: string | null }> = {}
  for (const row of data || []) {
    configMap[row.key] = { value: row.value, updated_at: row.updated_at }
  }

  return <HardcodedValuesClient initialConfig={configMap} />
}
