import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOpsCalendar, getOpsCalendarId } from '@/lib/google/calendar'

// POST /api/calendar/create
// Creates an event on the ops calendar via the service account.
// Body: { title, date, startTime?, endTime?, allDay? }

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, date, startTime, endTime, allDay } = body

  if (!title || !date) {
    return NextResponse.json(
      { error: 'title and date are required' },
      { status: 400 }
    )
  }

  let calendar
  try {
    calendar = await getOpsCalendar()
  } catch (err) {
    console.error('Service account not configured:', err)
    return NextResponse.json(
      { error: 'Service account not configured. Add GOOGLE_SERVICE_ACCOUNT_KEY in /config.' },
      { status: 503 }
    )
  }

  const calendarId = await getOpsCalendarId()

  // Build event payload
  const event: Record<string, unknown> = {
    summary: title,
  }

  if (allDay || (!startTime && !endTime)) {
    // All-day event
    event.start = { date }
    // Google expects end date to be exclusive (next day)
    const endDate = new Date(date + 'T00:00:00')
    endDate.setDate(endDate.getDate() + 1)
    event.end = { date: endDate.toISOString().split('T')[0] }
  } else {
    // Timed event
    const timeZone = 'America/Phoenix' // Praxis is in AZ
    const start = startTime || '09:00'
    const end = endTime || (() => {
      // Default to 1 hour after start
      const [h, m] = start.split(':').map(Number)
      const endH = h + 1
      return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    })()

    event.start = { dateTime: `${date}T${start}:00`, timeZone }
    event.end = { dateTime: `${date}T${end}:00`, timeZone }
  }

  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event as any,
    })

    return NextResponse.json({
      id: res.data.id,
      htmlLink: res.data.htmlLink,
    })
  } catch (err: any) {
    console.error('Failed to create event:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create event' },
      { status: 500 }
    )
  }
}
