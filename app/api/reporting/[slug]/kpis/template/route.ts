/**
 * Apply a KPI template to a client. Returns suggestions in the same shape as
 * /kpis/ai-recommend so the existing review/save modal handles them.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { applyTemplate, getTemplate, TEMPLATES } from '@/lib/reporting/templates'
import type { FileForSuggester } from '@/lib/reporting/ai-suggest'

export async function GET() {
  // Surface the template list (id, name, description) for the picker
  return NextResponse.json({
    templates: TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      industry: t.industry,
      kpi_count: t.kpis.length,
    })),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  let body: { template_id?: string; filenames?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.template_id) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
  }
  const template = getTemplate(body.template_id)
  if (!template) {
    return NextResponse.json({ error: `Unknown template: ${body.template_id}` }, { status: 404 })
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

  let q = supabase
    .from('report_raw_files')
    .select('filename, columns, rows')
    .eq('client_id', client.id)
  if (body.filenames && body.filenames.length > 0) {
    q = q.in('filename', body.filenames)
  }
  const { data: rawFiles } = await q
  if (!rawFiles || rawFiles.length === 0) {
    return NextResponse.json(
      { error: 'No synced files yet. Sync the Drive folder first.' },
      { status: 400 }
    )
  }

  const files: FileForSuggester[] = rawFiles.map((f) => ({
    filename: f.filename,
    columns: Array.isArray(f.columns) ? (f.columns as string[]) : [],
    sample_rows: (Array.isArray(f.rows) ? (f.rows as Record<string, unknown>[]) : []).slice(0, 12),
  }))

  const { suggestions, resolved, missing_roles } = applyTemplate({ template, files })

  return NextResponse.json({
    ok: true,
    template: { id: template.id, name: template.name },
    suggestions,
    resolved,
    missing_roles,
    source: 'template',
  })
}
