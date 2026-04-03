import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { BudgetClient } from './budget-client'

export const dynamic = 'force-dynamic'

export default async function BudgetPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()
  const { data: items } = await supabase
    .from('budget_items')
    .select('*')
    .eq('user_id', userId)
    .order('cost', { ascending: false })

  return <BudgetClient initialItems={items || []} />
}
