import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOAuth2Client } from '@/lib/google/calendar'

// GET /api/auth/google — redirect user to Google consent screen
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oauth2 = await getOAuth2Client()
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: userId, // pass userId through the flow
  })

  return NextResponse.redirect(url)
}
