import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase.from('app_config').select('key, value, updated_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ values: data || [] })
}

export async function PUT(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, value } = await request.json()
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  const supabase = createServerClient()
  const updated_at = new Date().toISOString()
  let { error } = await supabase
    .from('app_config')
    .upsert({ key, value, updated_by: userId, updated_at }, { onConflict: 'key' })

  // Defensive fallback for live DBs whose app_config.updated_by column is
  // missing (schema drift vs migration 010).
  if (error && /updated_by/i.test(error.message)) {
    const retry = await supabase
      .from('app_config')
      .upsert({ key, value, updated_at }, { onConflict: 'key' })
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: true, key })
}
