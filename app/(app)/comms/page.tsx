import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { CommsClient } from './comms-client'

export const dynamic = 'force-dynamic'

export default async function CommsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()
  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return <CommsClient initialWorkflows={workflows || []} />
}
