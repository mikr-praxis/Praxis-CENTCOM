import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { revokeToken } from '@/lib/github/client'

// POST /api/auth/github/disconnect — revoke and remove stored GitHub tokens
export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  // Fetch the existing token so we can revoke it on GitHub's side
  const { data: existing } = await supabase
    .from('github_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (existing?.access_token) {
    try {
      await revokeToken(existing.access_token)
    } catch (err) {
      // Non-fatal — still delete locally even if GitHub revocation fails
      console.error('GitHub token revocation failed:', err)
    }
  }

  const { error } = await supabase
    .from('github_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
