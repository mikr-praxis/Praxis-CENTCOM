/**
 * Safe auto-fix actions for /health page. Each action is idempotent and only
 * touches app_config (no schema changes, no destructive operations).
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { seedReportingConfigDefaults } from '@/lib/reporting/config'
import { seedBrandingDefaults } from '@/lib/branding'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  switch (body.action) {
    case 'seed_reporting_config':
      await seedReportingConfigDefaults(userId)
      return NextResponse.json({ ok: true, action: body.action })
    case 'seed_branding_config':
      await seedBrandingDefaults(userId)
      return NextResponse.json({ ok: true, action: body.action })
    default:
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
  }
}
