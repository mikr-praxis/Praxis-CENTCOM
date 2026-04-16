import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { ClientsBuildProgress } from './clients-build-progress'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()

  // Try to read clients table — if it fails, the migration hasn't been run
  let clients: Array<{ id: string; slug: string; name: string; funnel_type: string }> = []
  let migrationRun = false
  let sheetsApiEnabled = false
  let anthropicKeySet = false

  try {
    const { data, error } = await supabase.from('clients').select('id, slug, name, funnel_type')
    if (!error && data) {
      clients = data
      migrationRun = true
    }
  } catch {
    // Table doesn't exist yet
  }

  // Check env vars
  anthropicKeySet = !!process.env.ANTHROPIC_API_KEY
  sheetsApiEnabled = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY

  return (
    <ClientsBuildProgress
      migrationRun={migrationRun}
      sheetsApiEnabled={sheetsApiEnabled}
      anthropicKeySet={anthropicKeySet}
      clients={clients}
    />
  )
}
