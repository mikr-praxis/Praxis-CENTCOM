import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAuthorizationUrl } from '@/lib/github/client'

// GET /api/auth/github — redirect user to GitHub consent screen
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = await getAuthorizationUrl(userId)
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('GitHub auth redirect error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start GitHub auth' },
      { status: 500 }
    )
  }
}
