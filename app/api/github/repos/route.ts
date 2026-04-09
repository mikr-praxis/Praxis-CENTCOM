import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { getGitHubRepos } from '@/lib/github/client'

// GET /api/github/repos — fetch authenticated user's GitHub repositories
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Retrieve stored token
  const supabase = createServerClient()
  const { data: tokenRow, error: dbError } = await supabase
    .from('github_tokens')
    .select('access_token, github_username')
    .eq('user_id', userId)
    .single()

  if (dbError || !tokenRow?.access_token) {
    return NextResponse.json(
      { error: 'GitHub not connected. Connect at /config or /api/auth/github.' },
      { status: 403 }
    )
  }

  try {
    const page = Number(request.nextUrl.searchParams.get('page') || '1')
    const perPage = Number(request.nextUrl.searchParams.get('per_page') || '30')

    const repos = await getGitHubRepos(tokenRow.access_token, {
      page,
      per_page: perPage,
      sort: 'updated',
    })

    return NextResponse.json({
      username: tokenRow.github_username,
      repos,
      page,
      per_page: perPage,
    })
  } catch (err) {
    console.error('GitHub repos fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch repositories from GitHub' },
      { status: 502 }
    )
  }
}
