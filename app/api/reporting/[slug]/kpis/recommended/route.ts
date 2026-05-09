/**
 * Auto-seed catalog KPIs based on the columns of the client's synced files.
 * Reads kpi-catalog + recommended-kpis matcher, builds formulas, and bulk
 * inserts. Idempotent: catalog_keys already present on the client are
 * skipped, so the button can be clicked safely after new files sync.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { buildRecommendedKPIs, type FileColumns } from '@/lib/reporting/recommended-kpis'
import { isPostHogConfigured } from '@/lib/integrations/posthog-server'
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

  const { data: filesRaw } = await supabase
    .from('report_raw_files')
    .select('filename, columns')
    .eq('client_id', client.id)
    .order('modified_time', { ascending: false })

  const posthog = isPostHogConfigured()
  // Drive files are optional now: an external source like PostHog can power
  // a recommendation on its own. Only block when both are unavailable.
  if ((!filesRaw || filesRaw.length === 0) && !posthog) {
    return NextResponse.json(
      {
        error:
          'Nothing to recommend from. Sync the Drive folder, or set POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID to enable PostHog-backed KPIs.',
      },
      { status: 400 }
    )
  }

  const files: FileColumns[] = (filesRaw ?? []).map((f) => ({
    filename: (f.filename as string) ?? '',
    columns: Array.isArray(f.columns) ? (f.columns as string[]) : [],
  }))

  const { data: existingKpis } = await supabase
    .from('report_kpis')
    .select('key, display_order')
    .eq('client_id', client.id)
  const existingKeys = new Set((existingKpis ?? []).map((k) => k.key))
  const maxOrder = (existingKpis ?? []).reduce(
    (max, k) => Math.max(max, k.display_order ?? 0),
    -1
  )

  const recommendations = buildRecommendedKPIs(files, { posthog })

  type KPIInsert = Pick<ReportKPI, 'key' | 'display_name' | 'formula'> & Partial<ReportKPI>
  const inserts: KPIInsert[] = []
  let order = maxOrder + 1
  let skipped = 0

  for (const rec of recommendations) {
    if (existingKeys.has(rec.catalog_key)) {
      skipped++
      continue
    }
    inserts.push({
      client_id: client.id,
      key: rec.catalog_key,
      display_name: rec.display_name,
      description: `Auto-configured from synced files. ${rec.description}`,
      formula: rec.formula,
      format: rec.format,
      target: null,
      viz_type: rec.viz_type,
      display_order: order++,
    })
  }

  if (inserts.length === 0) {
    const message =
      recommendations.length === 0
        ? 'No catalog KPIs could be auto-configured from your synced files. Open the file in the configurator and use "+ Add KPI" to map columns manually.'
        : 'All recommended KPIs are already configured for this client.'
    return NextResponse.json({
      ok: true,
      inserted: 0,
      skipped,
      considered: recommendations.length,
      message,
    })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('report_kpis')
    .insert(inserts)
    .select()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    inserted: inserted?.length ?? 0,
    skipped,
    considered: recommendations.length,
    kpis: inserted,
  })
}
