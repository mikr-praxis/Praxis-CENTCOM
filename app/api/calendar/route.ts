import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getOpsCalendar,
  OPS_CALENDAR_ID,
  getUserCalendar,
  getOAuth2Client,
  fetchCalendarEvents,
  type CalendarEvent,
} from '@/lib/google/calendar'

// GET /api/calendar?start=ISO&end=ISO
// Returns events from ops calendar + user's connected calendar
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

  const allEvents: CalendarEvent[] = []
  const calendars: { id: string; name: string; color: string; email: string }[] = []

  // 1) Ops calendar (always loaded)
  try {
    const opsCalendar = getOpsCalendar()
    const opsEvents = await fetchCalendarEvents(
      opsCalendar,
      OPS_CALENDAR_ID,
      'Praxis Ops',
      '#f59e0b', // amber
      start,
      end
    )
    allEvents.push(...opsEvents)
    calendars.push({
      id: OPS_CALENDAR_ID,
      name: 'Praxis Ops',
      color: '#f59e0b',
      email: OPS_CALENDAR_ID,
    })
  } catch (err) {
    console.error('Failed to load ops calendar:', err)
  }

  // 2) User's connected Google Calendar
  const supabase = createServerClient()
  const { data: tokenRow } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (tokenRow) {
    let accessToken = tokenRow.access_token

    // Refresh if expired
    if (new Date(tokenRow.token_expiry) < new Date()) {
      try {
        const oauth2 = getOAuth2Client()
        oauth2.setCredentials({ refresh_token: tokenRow.refresh_token })
        const { credentials } = await oauth2.refreshAccessToken()
        accessToken = credentials.access_token || accessToken

        // Update stored token
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
        '#8b5cf6', // purple
        start,
        end
      )
      allEvents.push(...userEvents)
      calendars.push({
        id: 'primary',
        name: tokenRow.email,
        color: '#8b5cf6',
        email: tokenRow.email,
      })
    } catch (err) {
      console.error('Failed to load user calendar:', err)
    }
  }

  // Sort all events by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  return NextResponse.json({
    events: allEvents,
    calendars,
    userConnected: !!tokenRow,
  })
}
