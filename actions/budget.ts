'use server'

import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getBudgetItems() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('budget_items')
    .select('*')
    .eq('user_id', userId)
    .order('cost', { ascending: false })

  if (error) throw error
  return data
}

export async function createBudgetItem(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const name = formData.get('name') as string
  const plan = formData.get('plan') as string
  const cost = parseFloat(formData.get('cost') as string) || 0
  const expense_type = ((formData.get('expense_type') as string) || 'Business') as 'Personal' | 'Business'
  const card = formData.get('card') as string || null

  const supabase = createServerClient()
  const { error } = await supabase.from('budget_items').insert({
    name,
    plan,
    cost,
    expense_type,
    card,
    user_id: userId,
  })

  if (error) throw error
  revalidatePath('/budget')
  revalidatePath('/dashboard')
}

export async function deleteBudgetItem(id: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase
    .from('budget_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
  revalidatePath('/budget')
  revalidatePath('/dashboard')
}
