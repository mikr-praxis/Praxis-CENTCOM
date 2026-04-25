/**
 * Seed example KPIs for a client. Generates a few simple, sensible default
 * KPIs based on the client's currently synced files so the report page has
 * something to show before the user opens the configurator.
 *
 * Idempotent: only inserts KPIs whose `key` doesn't already exist for the client.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import type { ReportKPI } from '@/lib/supabase/types'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = createServerClient()

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('slug', slug)
    .single()
  if (clientErr || !client) {
    return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
  }

  // Pull synced files so we can scope KPIs to real filenames
  const { data: files } = await supabase
    .from('report_raw_files')
    .select('filename, columns')
    .eq('client_id', client.id)
    .order('modified_time', { ascending: false })

  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: 'No files synced yet. Sync the Drive folder first.' },
      { status: 400 }
    )
  }

  const { data: existingKpis } = await supabase
    .from('report_kpis')
    .select('key')
    .eq('client_id', client.id)
  const existingKeys = new Set((existingKpis ?? []).map((k) => k.key))

  // Build candidate KPIs
  const candidates: Partial<ReportKPI>[] = []
  let order = 0
  for (const file of files.slice(0, 3)) {
    const safeKey = `total_${file.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()}`
    if (!existingKeys.has(safeKey)) {
      candidates.push({
        client_id: client.id,
        key: safeKey,
        display_name: `Total rows in ${file.filename}`,
        description: 'Auto-seeded KPI: total records in this file. Edit in the configurator.',
        formula: { op: 'count', source: file.filename },
        format: 'count',
        target: null,
        viz_type: 'card',
        display_order: order++,
      })
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'Already seeded' })
  }

  const { data, error: insErr } = await supabase
    .from('report_kpis')
    .insert(candidates)
    .select()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, inserted: data?.length ?? 0, kpis: data })
}
