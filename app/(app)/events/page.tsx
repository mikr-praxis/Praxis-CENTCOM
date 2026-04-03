import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { EventsClient } from './events-client'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: true })

  return <EventsClient initialEvents={events || []} />
}
