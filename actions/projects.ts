'use server'

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getProjects() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createProject(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || null
  const status = ((formData.get('status') as string) || 'planned') as 'planned' | 'in-progress' | 'complete'
  const category = ((formData.get('category') as string) || 'core') as 'core' | 'integration' | 'infrastructure' | 'ai'
  const priority = ((formData.get('priority') as string) || 'medium') as 'high' | 'medium' | 'low'
  const targetDate = (formData.get('target_date') as string) || null

  const supabase = createServerClient()
  const { error } = await supabase.from('projects').insert({
    name,
    description,
    status,
    category,
    priority,
    target_date: targetDate || null,
    progress: status === 'complete' ? 100 : 0,
    user_id: userId,
  })

  if (error) throw error
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

export async function updateProject(id: string, updates: Record<string, unknown>) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

export async function deleteProject(id: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}
