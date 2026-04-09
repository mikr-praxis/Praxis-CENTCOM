import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, getGitHubUser } from '@/lib/github/client'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/auth/github/callback — exchange code for token, store in Supabase
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const userId = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    console.error('GitHub OAuth denied:', error)
    return NextResponse.redirect(new URL('/config?github=denied', request.url))
  }

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/config?github=missing_params', request.url))
  }

  try {
    // Exchange authorization code for access token
    const tokenData = await exchangeCodeForToken(code)

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL('/config?github=no_token', request.url))
    }

    // Fetch user profile from GitHub
    const ghUser = await getGitHubUser(tokenData.access_token)

    // Upsert token in Supabase
    const supabase = createServerClient()
    const { error: dbError } = await supabase.from('github_tokens').upsert(
      {
        user_id: userId,
        github_username: ghUser.login,
        github_id: ghUser.id,
        access_token: tokenData.access_token,
        token_scope: tokenData.scope,
        avatar_url: ghUser.avatar_url || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (dbError) {
      console.error('Failed to store GitHub token:', dbError)
      return NextResponse.redirect(new URL('/config?github=storage_failed', request.url))
    }

    return NextResponse.redirect(new URL('/config?github=connected', request.url))
  } catch (err) {
    console.error('GitHub OAuth callback error:', err)
    return NextResponse.redirect(new URL('/config?github=oauth_failed', request.url))
  }
}
