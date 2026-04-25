import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; slug?: string; funnel_type?: 'call' | 'webinar' | 'challenge' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const name = body.name.trim()
  const slug = (body.slug?.trim() || slugify(name)) || ''
  if (!slug) {
    return NextResponse.json({ error: 'Could not derive slug — provide one explicitly.' }, { status: 400 })
  }
  const funnelType = body.funnel_type ?? 'call'
  if (!['call', 'webinar', 'challenge'].includes(funnelType)) {
    return NextResponse.json({ error: 'funnel_type must be call, webinar, or challenge' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: `A client with slug "${slug}" already exists.` },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ name, slug, funnel_type: funnelType })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, client: data })
}
