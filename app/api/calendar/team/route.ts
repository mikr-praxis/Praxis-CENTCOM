import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

// Default colors to cycle through for new team members
const COLORS = [
  '#8b5cf6', '#ef4444', '#3b82f6', '#10b981',
  '#ec4899', '#f97316', '#06b6d4', '#84cc16',
  '#a855f7', '#f43f5e', '#0ea5e9', '#14b8a6',
]

// POST /api/calendar/team — add or update a team calendar entry
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { email, displayName, color, role } = body

  if (!email || !displayName) {
    return NextResponse.json(
      { error: 'email and displayName are required' },
      { status: 400 }
    )
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Pick a color if none provided — use the count of existing calendars to cycle
  let assignedColor = color
  if (!assignedColor) {
    const { count } = await supabase
      .from('team_calendars')
      .select('*', { count: 'exact', head: true })
    assignedColor = COLORS[(count || 0) % COLORS.length]
  }

  const { data, error } = await supabase
    .from('team_calendars')
    .upsert(
      {
        email: email.toLowerCase().trim(),
        display_name: displayName.trim(),
        color: assignedColor,
        role: role || 'Team Member',
        is_ops: false,
        enabled: true,
        source: 'manual',
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (error) {
    console.error('Failed to upsert team calendar:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ calendar: data })
}

// DELETE /api/calendar/team?email=... — disable (soft-delete) a team calendar
export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json(
      { error: 'email query param required' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Soft-delete: disable rather than remove
  const { error } = await supabase
    .from('team_calendars')
    .update({ enabled: false })
    .eq('email', email.toLowerCase().trim())

  if (error) {
    console.error('Failed to disable team calendar:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
