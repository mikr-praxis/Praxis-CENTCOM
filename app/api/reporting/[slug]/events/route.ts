import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = createServerClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { data: events } = await supabase
    .from('client_events')
    .select('id, event_name, event_date, event_type, notes')
    .eq('client_id', client.id)
    .order('event_date', { ascending: false })

  return NextResponse.json({ events: events ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { event_name?: string; event_date?: string; event_type?: string | null; notes?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.event_name?.trim() || !body.event_date) {
    return NextResponse.json({ error: 'event_name and event_date are required' }, { status: 400 })
  }
  if (body.event_type && !['launch', 'challenge', 'webinar', 'sale'].includes(body.event_type)) {
    return NextResponse.json(
      { error: 'event_type must be launch | challenge | webinar | sale' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single()
  if (error || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  const { data, error: insErr } = await supabase
    .from('client_events')
    .insert({
      client_id: client.id,
      event_name: body.event_name.trim(),
      event_date: body.event_date,
      event_type: (body.event_type as 'launch' | 'challenge' | 'webinar' | 'sale' | undefined) ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, event: data })
}
