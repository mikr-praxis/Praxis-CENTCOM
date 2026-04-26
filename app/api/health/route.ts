import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { runHealthChecks } from '@/lib/health/checks'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const report = await runHealthChecks()
  return NextResponse.json(report)
}
