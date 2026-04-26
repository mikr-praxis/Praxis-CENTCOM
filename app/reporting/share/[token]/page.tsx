/**
 * Public client-facing report. No Clerk auth — validates a share token instead.
 * Lives outside the (app) group so it bypasses the auth-gated layout.
 */

import { createServerClient } from '@/lib/supabase/server'
import { getBrandingConfig } from '@/lib/branding'
import { ShareReport } from './share-report'

export const dynamic = 'force-dynamic'

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServerClient()

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('report_share_tokens')
    .select('client_id, expires_at, revoked_at')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Report not found</h1>
          <p className="text-slate-400 text-sm mt-2">This link is invalid or has been removed.</p>
        </div>
      </div>
    )
  }
  if (tokenRow.revoked_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Access revoked</h1>
          <p className="text-slate-400 text-sm mt-2">This link is no longer active.</p>
        </div>
      </div>
    )
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Link expired</h1>
          <p className="text-slate-400 text-sm mt-2">Please request a new share link.</p>
        </div>
      </div>
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, name')
    .eq('id', tokenRow.client_id)
    .single()

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Client missing</h1>
          <p className="text-slate-400 text-sm mt-2">This report can no longer be loaded.</p>
        </div>
      </div>
    )
  }

  const branding = await getBrandingConfig()

  return (
    <ShareReport
      token={token}
      clientName={client.name}
      branding={branding}
    />
  )
}
