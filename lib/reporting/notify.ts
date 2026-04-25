/**
 * Slack notifications for sync events. No-ops cleanly when:
 * - REPORTING_SYNC_NOTIFY_CHANNEL_ID is not configured
 * - SLACK_BOT_TOKEN is not configured
 * - The Slack call throws for any reason (network, perms, channel deleted)
 *
 * Never blocks or rejects the caller — sync routes always 200 even if
 * notification fails.
 */

import { getSlackClient } from '@/lib/slack'
import { getReportingSyncNotifyChannelId } from './config'
import type { SyncResult } from './sync'

interface NotifyArgs {
  /** Optional client name for single-client manual sync. Omit for cron multi-client. */
  clientName?: string
  results: SyncResult[]
  /** Errors to flag prominently (e.g., from per-client try/catch in cron). */
  topLevelErrors?: { slug: string; error: string }[]
}

export async function notifySyncComplete(args: NotifyArgs): Promise<void> {
  let channelId: string | null
  try {
    channelId = await getReportingSyncNotifyChannelId()
  } catch {
    return
  }
  if (!channelId) return

  const totalSeen = args.results.reduce((a, r) => a + r.files_seen, 0)
  const totalSynced = args.results.reduce((a, r) => a + r.files_synced, 0)
  const totalSkipped = args.results.reduce((a, r) => a + r.files_skipped, 0)
  const totalUnsupported = args.results.reduce((a, r) => a + r.files_unsupported, 0)
  const fileErrors = args.results.flatMap((r) => r.errors)
  const totalErrors = fileErrors.length + (args.topLevelErrors?.length ?? 0)
  const clientCount = args.results.length

  const headline = args.clientName
    ? `*Sync — ${args.clientName}*`
    : `*Weekly Drive sync — ${clientCount} client${clientCount === 1 ? '' : 's'}*`

  const lines = [
    headline,
    `• Files seen: ${totalSeen}`,
    `• Synced: ${totalSynced}`,
    `• Skipped (unchanged): ${totalSkipped}`,
    ...(totalUnsupported > 0 ? [`• Unsupported: ${totalUnsupported}`] : []),
    ...(totalErrors > 0 ? [`• ⚠️ Errors: ${totalErrors}`] : []),
  ]

  // Per-client summary for multi-client cron
  if (!args.clientName && args.results.length > 0) {
    lines.push('')
    for (const r of args.results) {
      const slugLine = `• \`${r.client_id.slice(0, 8)}\` synced=${r.files_synced} seen=${r.files_seen}${r.errors.length > 0 ? ` errors=${r.errors.length}` : ''}`
      lines.push(slugLine)
    }
  }

  // Surface first few errors inline
  const errorSamples = [
    ...fileErrors.slice(0, 3).map((e) => `${e.file}: ${e.error}`),
    ...(args.topLevelErrors?.slice(0, 3).map((e) => `${e.slug}: ${e.error}`) ?? []),
  ]
  if (errorSamples.length > 0) {
    lines.push('')
    lines.push('*First errors:*')
    for (const s of errorSamples) {
      lines.push(`> ${s}`)
    }
  }

  try {
    const client = await getSlackClient()
    await client.chat.postMessage({
      channel: channelId,
      text: lines.join('\n'),
    })
  } catch {
    // Best-effort. Don't surface failures to the sync caller.
  }
}
