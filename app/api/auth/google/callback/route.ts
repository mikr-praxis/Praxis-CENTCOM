import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getOAuth2Client } from '@/lib/google/calendar'
import { createServerClient } from '@/lib/supabase/server'

// GET /api/auth/google/callback — exchange code for tokens, store in Supabase
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const userId = request.nextUrl.searchParams.get('state')

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/calendar?error=missing_params', request.url))
  }

  try {
    const oauth2 = getOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/calendar?error=no_tokens', request.url))
    }

    // Get user's email from Google
    oauth2.setCredentials(tokens)
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data: profile } = await oauth2Api.userinfo.get()
    const email = profile.email || 'unknown'

    // Upsert token in Supabase
    const supabase = createServerClient()
    const { error } = await supabase.from('google_tokens').upsert(
      {
        user_id: userId,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('Failed to store Google tokens:', error)
      return NextResponse.redirect(new URL('/calendar?error=storage_failed', request.url))
    }

    return NextResponse.redirect(new URL('/calendar?connected=true', request.url))
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(new URL('/calendar?error=oauth_failed', request.url))
  }
}
