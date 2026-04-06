import { google, calendar_v3 } from 'googleapis'
import { getConfig } from '@/lib/config'

// ── Ops calendar (OAuth2 with refresh token) ───────────────────────────
// The mscott@builtbypraxis.com calendar is accessed via OAuth2 credentials
// with a long-lived refresh token (obtained once via OAuth Playground).
// Config keys: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

async function getOpsAuth() {
  const clientId = await getConfig('GOOGLE_CLIENT_ID')
  const clientSecret = await getConfig('GOOGLE_CLIENT_SECRET')
  const refreshToken = await getConfig('GOOGLE_REFRESH_TOKEN')

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Calendar OAuth2 credentials are not set. ' +
      'Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN at /config.'
    )
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

let _opsCalendar: calendar_v3.Calendar | null = null
let _opsRefreshToken: string | null = null

export async function getOpsCalendar() {
  const token = await getConfig('GOOGLE_REFRESH_TOKEN')
  // Re-create if token changed (hot-swap after config edit)
  if (!_opsCalendar || _opsRefreshToken !== token) {
    const auth = await getOpsAuth()
    _opsCalendar = google.calendar({ version: 'v3', auth })
    _opsRefreshToken = token || null
  }
  return _opsCalendar
}

// The calendar ID for ops@builtbypraxis.com — defaults to the email itself
// unless overridden (some orgs use a shared calendar with a different ID).
export async function getOpsCalendarId(): Promise<string> {
  return (await getConfig('OPS_CALENDAR_ID')) || 'ops@builtbypraxis.com'
}

// ── User calendars (OAuth2) ─────────────────────────────────────────────
// Each user can connect their own Google Calendar via OAuth2.
// Tokens are stored in Supabase (google_tokens table).

export async function getOAuth2Client() {
  const clientId = await getConfig('GOOGLE_CLIENT_ID')
  const clientSecret = await getConfig('GOOGLE_CLIENT_SECRET')
  const redirectUri = (await getConfig('GOOGLE_REDIRECT_URI')) ||
    `${await getConfig('NEXT_PUBLIC_APP_URL')}/api/auth/google/callback`

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getUserCalendar(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth })
}

// ── Shared helpers ──────────────────────────────────────────────────────

export type CalendarEvent = {
  id: string
  title: string
  start: string          // ISO datetime
  end: string            // ISO datetime
  allDay: boolean
  calendarId: string     // which calendar this came from
  calendarName: string   // display name
  color: string          // hex color for UI layering
  location?: string
  description?: string
  htmlLink?: string
}

export function mapGoogleEvent(
  event: calendar_v3.Schema$Event,
  calendarId: string,
  calendarName: string,
  color: string
): CalendarEvent | null {
  if (!event.id) return null

  const startDate = event.start?.dateTime || event.start?.date
  const endDate = event.end?.dateTime || event.end?.date
  if (!startDate || !endDate) return null

  return {
    id: event.id,
    title: event.summary || '(No title)',
    start: startDate,
    end: endDate,
    allDay: !event.start?.dateTime,
    calendarId,
    calendarName,
    color,
    location: event.location || undefined,
    description: event.description || undefined,
    htmlLink: event.htmlLink || undefined,
  }
}

export async function fetchCalendarEvents(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  calendarName: string,
  color: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    })

    return (res.data.items || [])
      .map((e) => mapGoogleEvent(e, calendarId, calendarName, color))
      .filter((e): e is CalendarEvent => e !== null)
  } catch (err) {
    console.error(`Failed to fetch calendar ${calendarId}:`, err)
    return []
  }
}
