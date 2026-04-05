import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

// POST /api/auth/google/disconnect — remove stored Google tokens
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('google_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
