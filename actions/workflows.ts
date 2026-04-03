'use server'

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getWorkflows() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function toggleWorkflow(id: string, newStatus: 'active' | 'paused') {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('workflows')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/comms')
}

export async function createWorkflow(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const name = formData.get('name') as string
  const schedule = formData.get('schedule') as string || null
  const platform = (formData.get('platform') as string) || 'Slack'

  const supabase = createServerClient()
  const { error } = await supabase.from('workflows').insert({
    name,
    schedule,
    platform,
    status: 'active',
    user_id: userId,
  })

  if (error) throw error
  revalidatePath('/comms')
}
