import { google, calendar_v3 } from 'googleapis'
import { getConfig } from '@/lib/config'

// ── Ops calendar (service account) ──────────────────────────────────────
// The ops@builtbypraxis.com calendar is accessed via a service account
// whose JSON key is stored as a single env var (base64-encoded).

async function getServiceAuth() {
  const encoded = await getConfig('GOOGLE_SERVICE_ACCOUNT_KEY')
  if (!encoded) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set. Configure it at /config.')

  const credentials = JSON.parse(
    Buffer.from(encoded, 'base64').toString('utf-8')
  )

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
}

let _opsCalendar: calendar_v3.Calendar | null = null
let _opsServiceKey: string | null = null

export async function getOpsCalendar() {
  const key = await getConfig('GOOGLE_SERVICE_ACCOUNT_KEY')
  // Re-create if key changed (hot-swap after config edit)
  if (!_opsCalendar || _opsServiceKey !== key) {
    const auth = await getServiceAuth()
    _opsCalendar = google.calendar({ version: 'v3', auth })
    _opsServiceKey = key || null
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
