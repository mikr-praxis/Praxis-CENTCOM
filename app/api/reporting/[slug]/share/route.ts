import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateShareToken } from '@/lib/reporting/share-tokens'

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

  const { data: tokens } = await supabase
    .from('report_share_tokens')
    .select('id, token, label, created_at, expires_at, revoked_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ tokens: tokens ?? [] })
}

export async function POST(
  request: Request,
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

  let body: { label?: string; expires_at?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    // empty body OK
  }

  const token = generateShareToken()
  const { data, error: insErr } = await supabase
    .from('report_share_tokens')
    .insert({
      client_id: client.id,
      token,
      label: body.label ?? null,
      expires_at: body.expires_at ?? null,
      created_by: userId,
    })
    .select()
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, token: data })
}
