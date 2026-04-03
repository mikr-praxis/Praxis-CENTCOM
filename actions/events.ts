'use server'

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getEvents() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: true })

  if (error) throw error
  return data
}

export async function createEvent(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const title = formData.get('title') as string
  const event_date = formData.get('event_date') as string
  const event_time = formData.get('event_time') as string || null
  const duration = formData.get('duration') as string || null
  const event_type = (formData.get('event_type') as string) || 'internal'
  const attendees = parseInt(formData.get('attendees') as string) || 1

  const supabase = createServerClient()
  const { error } = await supabase.from('events').insert({
    title,
    event_date,
    event_time,
    duration,
    event_type,
    attendees,
    user_id: userId,
  })

  if (error) throw error
  revalidatePath('/events')
  revalidatePath('/dashboard')
}

export async function deleteEvent(id: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/events')
  revalidatePath('/dashboard')
}
