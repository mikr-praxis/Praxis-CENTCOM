import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { CommsClient } from './comms-client'

export const dynamic = 'force-dynamic'

export default async function CommsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()
  const [workflowsRes, logsRes] = await Promise.all([
    supabase
      .from('workflows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('message_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <CommsClient
      initialWorkflows={workflowsRes.data || []}
      initialMessageLogs={logsRes.data || []}
    />
  )
}
