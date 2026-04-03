'use server'

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getTasks() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createTask(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const title = formData.get('title') as string
  const priority = ((formData.get('priority') as string) || 'medium') as 'high' | 'medium' | 'low'
  const assignee = formData.get('assignee') as string || null
  const dueDate = formData.get('due_date') as string || null
  const tag = formData.get('tag') as string || null

  const supabase = createServerClient()
  const { error } = await supabase.from('tasks').insert({
    title,
    priority,
    assignee,
    due_date: dueDate || null,
    tag,
    user_id: userId,
    status: 'todo' as const,
  })

  if (error) throw error
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}

export async function advanceTask(taskId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const statusOrder = ['todo', 'inprogress', 'review', 'done'] as const

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (!task) throw new Error('Task not found')

  const currentIndex = statusOrder.indexOf(task.status as typeof statusOrder[number])
  if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) return

  const newStatus = statusOrder[currentIndex + 1]

  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}

export async function deleteTask(taskId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}
