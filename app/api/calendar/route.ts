import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getOpsCalendar,
  getUserCalendar,
  getOAuth2Client,
  fetchCalendarEvents,
  type CalendarEvent,
} from '@/lib/google/calendar'

export type TeamCalendar = {
  id: string
  email: string
  name: string
  color: string
  role: string | null
  isOps: boolean
  enabled: boolean
  source: string
  hasAccess: boolean   // true if we successfully fetched events
}

// GET /api/calendar?start=ISO&end=ISO
// Returns events from ops calendar + all team member calendars
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = request.nextUrl.searchParams.get('start')
  const end = request.nextUrl.searchParams.get('end')

  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end query params required (ISO date strings)' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const allEvents: CalendarEvent[] = []
  const calendars: TeamCalendar[] = []

  // ── 1. Load team calendars from DB ────────────────────────────────
  const { data: teamCalendars } = await supabase
    .from('team_calendars')
    .select('*')
    .eq('enabled', true)
    .order('is_ops', { ascending: false }) // ops first

  // ── 2. Get the OAuth2 calendar client (if configured) ─────────────
  let opsCalClient: Awaited<ReturnType<typeof getOpsCalendar>> | null = null
  try {
    opsCalClient = await getOpsCalendar()
  } catch (err) {
    console.error('Google Calendar OAuth2 not configured:', err)
  }

  // ── 3. Fetch each team calendar via OAuth2 ───────────────────────
  // The authenticated user (mscott@builtbypraxis.com) can read any
  // calendar shared with them — team members share their calendars.
  if (teamCalendars && opsCalClient) {
    const fetches = teamCalendars.map(async (tc) => {
      try {
        const events = await fetchCalendarEvents(
          opsCalClient!,
          tc.email,
          tc.display_name,
          tc.color,
          start,
          end
        )
        allEvents.push(...events)
        calendars.push({
          id: tc.id,
          email: tc.email,
          name: tc.display_name,
          color: tc.color,
          role: tc.role,
          isOps: tc.is_ops,
          enabled: tc.enabled,
          source: tc.source,
          hasAccess: true,
        })
      } catch (err) {
        // Calendar not shared with authenticated user — still list it but flag it
        console.error(`Cannot read calendar ${tc.email}:`, err)
        calendars.push({
          id: tc.id,
          email: tc.email,
          name: tc.display_name,
          color: tc.color,
          role: tc.role,
          isOps: tc.is_ops,
          enabled: tc.enabled,
          source: tc.source,
          hasAccess: false,
        })
      }
    })
    await Promise.all(fetches)
  } else if (teamCalendars) {
    // OAuth2 not available — still list calendars as non-accessible
    for (const tc of teamCalendars) {
      calendars.push({
        id: tc.id,
        email: tc.email,
        name: tc.display_name,
        color: tc.color,
        role: tc.role,
        isOps: tc.is_ops,
        enabled: tc.enabled,
        source: tc.source,
        hasAccess: false,
      })
    }
  }

  // ── 4. User's own OAuth-connected calendar (fallback / supplement) ─
  // If the current user connected via OAuth AND their calendar isn't
  // already covered by a team_calendars entry, add it.
  const { data: tokenRow } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  const userOAuthConnected = !!tokenRow
  const userAlreadyCovered = calendars.some(
    (c) => c.hasAccess && c.email === tokenRow?.email
  )

  if (tokenRow && !userAlreadyCovered) {
    let accessToken = tokenRow.access_token

    // Refresh if expired
    if (new Date(tokenRow.token_expiry) < new Date()) {
      try {
        const oauth2 = await getOAuth2Client()
        oauth2.setCredentials({ refresh_token: tokenRow.refresh_token })
        const { credentials } = await oauth2.refreshAccessToken()
        accessToken = credentials.access_token || accessToken

        await supabase
          .from('google_tokens')
          .update({
            access_token: accessToken,
            token_expiry: new Date(
              credentials.expiry_date || Date.now() + 3600000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
      } catch (err) {
        console.error('Failed to refresh user token:', err)
      }
    }

    try {
      const userCal = getUserCalendar(accessToken)
      const userEvents = await fetchCalendarEvents(
        userCal,
        'primary',
        tokenRow.email,
        '#8b5cf6',
        start,
        end
      )
      allEvents.push(...userEvents)
      calendars.push({
        id: `oauth-${userId}`,
        email: tokenRow.email,
        name: `${tokenRow.email} (personal)`,
        color: '#8b5cf6',
        role: null,
        isOps: false,
        enabled: true,
        source: 'oauth',
        hasAccess: true,
      })
    } catch (err) {
      console.error('Failed to load user OAuth calendar:', err)
    }
  }

  // Sort all events by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  return NextResponse.json({
    events: allEvents,
    calendars,
    userConnected: userOAuthConnected,
  })
}
