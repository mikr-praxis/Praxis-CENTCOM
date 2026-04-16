'use server'

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ProjectStage } from '@/lib/supabase/types'

export async function getProjects() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getProject(projectId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}

export async function createProject(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const name = formData.get('name') as string
  const stage = (formData.get('stage') as ProjectStage) || 'lead'
  const priority = (formData.get('priority') as 'high' | 'medium' | 'low') || 'medium'
  const slackTag = formData.get('slack_tag') as string || null
  const clientTag = formData.get('client_tag') as string || null
  const ownerId = formData.get('owner_id') as string || null
  const description = formData.get('description') as string || null
  const deadline = formData.get('deadline') as string || null

  const supabase = createServerClient()
  const { error } = await supabase.from('projects').insert({
    name,
    stage,
    priority,
    slack_tag: slackTag,
    client_tag: clientTag,
    owner_id: ownerId,
    description,
    deadline: deadline || null,
    user_id: userId,
  })

  if (error) throw error
  revalidatePath('/projects')
}

export async function advanceProject(projectId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const stageOrder: ProjectStage[] = [
    'lead', 'discovery', 'proposal', 'onboarded', 'building', 'qa', 'deployed',
  ]

  const supabase = createServerClient()
  const { data: project } = await supabase
    .from('projects')
    .select('stage')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) throw new Error('Project not found')

  const currentIndex = stageOrder.indexOf(project.stage as ProjectStage)
  if (currentIndex === -1 || currentIndex >= stageOrder.length - 1) return

  const newStage = stageOrder[currentIndex + 1]

  const { error } = await supabase
    .from('projects')
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/projects')
}

export async function updateProjectStage(projectId: string, stage: ProjectStage) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('projects')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/projects')
}

export async function updateProject(projectId: string, formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const fields = ['name', 'description', 'notes', 'slack_tag', 'client_tag', 'owner_id', 'priority', 'stage'] as const
  for (const field of fields) {
    const value = formData.get(field)
    if (value !== null) updates[field] = value || null
  }
  const deadline = formData.get('deadline')
  if (deadline !== null) updates.deadline = deadline || null

  const supabase = createServerClient()
  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteProject(projectId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/projects')
}
