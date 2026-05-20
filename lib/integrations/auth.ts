/**
 * Shared auth helper for /api/integrations/* routes.
 *
 * Each integration's sync/webhook endpoint accepts EITHER a Clerk session
 * (when triggered from the UI by a signed-in user) OR a `Bearer ${CRON_SECRET}`
 * header (when triggered by Vercel cron or GitHub Actions). This centralizes
 * that check so per-provider routes don't have to duplicate it.
 *
 * The middleware whitelists `/api/integrations/*` so requests reach the
 * handler regardless of session — actual authorization happens here.
 */
import { auth } from '@clerk/nextjs/server'

export async function isIntegrationAuthorized(req: Request): Promise<boolean> {
  // 1) Signed-in Clerk user (UI-triggered sync).
  const { userId } = await auth()
  if (userId) return true

  // 2) Cron / CI / Actions — Bearer ${CRON_SECRET}.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const header = req.headers.get('authorization') || ''
    if (header === `Bearer ${cronSecret}`) return true
  }

  return false
}
