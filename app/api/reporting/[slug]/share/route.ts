import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateShareToken } from '@/lib/reporting/share-tokens'
import { getShareTokenDefaultExpiryDays } from '@/lib/reporting/config'

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

  let body: { label?: string; expires_at?: string | null; never_expires?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // empty body OK
  }

  // Resolve expires_at:
  // - If body.expires_at provided → use it
  // - Else if body.never_expires === true → null (no expiry)
  // - Else → now + SHARE_TOKEN_DEFAULT_EXPIRY_DAYS (or null if config = 0)
  let expiresAt: string | null = null
  if (body.expires_at) {
    expiresAt = body.expires_at
  } else if (!body.never_expires) {
    const days = await getShareTokenDefaultExpiryDays()
    if (days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const token = generateShareToken()
  const { data, error: insErr } = await supabase
    .from('report_share_tokens')
    .insert({
      client_id: client.id,
      token,
      label: body.label ?? null,
      expires_at: expiresAt,
      created_by: userId,
    })
    .select()
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, token: data })
}
