/**
 * Health checks — runs server-side, returns a categorized status report for
 * the /health admin page. Each check is best-effort and never throws past its
 * own boundary; failures show up as 'fail' results with a message.
 */

import { createServerClient } from '@/lib/supabase/server'
import { getConfig } from '@/lib/config'
import { listChildFolders } from '@/lib/google/drive'
import { getSlackClient } from '@/lib/slack'
import { REPORTING_CONFIG_DEFAULTS } from '@/lib/reporting/config'
import { BRANDING_DEFAULTS } from '@/lib/branding'

export type HealthStatus = 'ok' | 'warn' | 'fail' | 'info'

export type AutoFixAction =
  | 'seed_reporting_config'
  | 'seed_branding_config'
  | 'discover_drive_folders'
  | 'sync_all_clients'
  | 'test_slack'
  | 'connect_everything'

export interface HealthCheck {
  id: string
  category: string
  name: string
  status: HealthStatus
  message: string
  fix?: {
    description?: string
    /** Slug for an auto-fix POST endpoint that the UI can call. */
    auto_fix?: AutoFixAction
    /** External link the user should open to remediate (e.g. GCP console). */
    doc_link?: string
  }
}

export interface HealthReport {
  ran_at: string
  checks: HealthCheck[]
  /** Quick rollup for sidebar dot / page header */
  summary: { ok: number; warn: number; fail: number; info: number }
}

/* ─────────────────────────── individual checks ─────────────────────────── */

async function checkEnvVar(name: string, opts: {
  category: string
  description?: string
  warnOnly?: boolean
}): Promise<HealthCheck> {
  const present = !!process.env[name] && process.env[name]!.length > 0
  return {
    id: `env_${name}`,
    category: opts.category,
    name: name,
    status: present ? 'ok' : opts.warnOnly ? 'warn' : 'fail',
    message: present ? 'Set' : 'Missing',
    ...(present
      ? {}
      : {
          fix: {
            description:
              opts.description ??
              `Add ${name} as an environment variable in Vercel → Settings → Environment Variables, then redeploy.`,
            doc_link: 'https://vercel.com/mscott-8907s-projects/praxis-centcom/settings/environment-variables',
          },
        }),
  }
}

async function checkTable(
  table: string,
  category: string,
  description: string
): Promise<HealthCheck> {
  const supabase = createServerClient()
  try {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      return {
        id: `table_${table}`,
        category,
        name: `Table: ${table}`,
        status: 'fail',
        message: error.message,
        fix: { description },
      }
    }
    return {
      id: `table_${table}`,
      category,
      name: `Table: ${table}`,
      status: 'ok',
      message: 'Reachable',
    }
  } catch (e) {
    return {
      id: `table_${table}`,
      category,
      name: `Table: ${table}`,
      status: 'fail',
      message: e instanceof Error ? e.message : 'Unreachable',
      fix: { description },
    }
  }
}

async function checkColumn(
  table: string,
  column: string,
  category: string,
  migration: string
): Promise<HealthCheck> {
  const supabase = createServerClient()
  try {
    const { error } = await supabase.from(table).select(column).limit(1)
    if (error) {
      return {
        id: `col_${table}_${column}`,
        category,
        name: `Column: ${table}.${column}`,
        status: 'fail',
        message: error.message,
        fix: { description: `Run migration ${migration} in the Supabase SQL editor.` },
      }
    }
    return {
      id: `col_${table}_${column}`,
      category,
      name: `Column: ${table}.${column}`,
      status: 'ok',
      message: 'Present',
    }
  } catch (e) {
    return {
      id: `col_${table}_${column}`,
      category,
      name: `Column: ${table}.${column}`,
      status: 'fail',
      message: e instanceof Error ? e.message : 'Unreachable',
      fix: { description: `Run migration ${migration} in the Supabase SQL editor.` },
    }
  }
}

async function checkConfigKey(
  key: string,
  category: string,
  expected: string,
  warnOnly = false
): Promise<HealthCheck> {
  try {
    const v = await getConfig(key)
    const present = v != null && v.trim().length > 0
    return {
      id: `cfg_${key}`,
      category,
      name: key,
      status: present ? 'ok' : warnOnly ? 'warn' : 'fail',
      message: present ? `Set: ${v!.length > 60 ? v!.slice(0, 57) + '…' : v}` : `Not set (default would be: ${expected || 'none'})`,
      ...(present
        ? {}
        : {
            fix: {
              description: `Set the ${key} value at /hardcoded.`,
              auto_fix: warnOnly ? undefined : key.startsWith('APP_') || key.startsWith('KPI_') ? 'seed_branding_config' : 'seed_reporting_config',
            },
          }),
    }
  } catch (e) {
    return {
      id: `cfg_${key}`,
      category,
      name: key,
      status: 'fail',
      message: e instanceof Error ? e.message : 'Read failed',
    }
  }
}

async function checkDriveAPI(): Promise<HealthCheck> {
  try {
    const parent = await getConfig('DRIVE_REPORTS_PARENT_FOLDER_ID') || REPORTING_CONFIG_DEFAULTS.DRIVE_REPORTS_PARENT_FOLDER_ID
    if (!parent) {
      return {
        id: 'drive_api',
        category: 'Integrations',
        name: 'Google Drive API',
        status: 'warn',
        message: 'No parent folder configured — cannot test reachability',
        fix: { description: 'Set DRIVE_REPORTS_PARENT_FOLDER_ID at /hardcoded.' },
      }
    }
    const folders = await listChildFolders(parent)
    return {
      id: 'drive_api',
      category: 'Integrations',
      name: 'Google Drive API',
      status: 'ok',
      message: `Reachable. ${folders.length} subfolder${folders.length === 1 ? '' : 's'} under parent.`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    let fix = 'Check the Drive API is enabled on the GCP project + the service account is a Viewer on the parent folder.'
    if (msg.includes('API has not been used') || msg.includes('disabled')) {
      fix = 'Enable Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=unified-atom-492422-n5'
    } else if (msg.includes('File not found') || msg.includes('404')) {
      fix = 'Service account is not shared on the parent folder. Open the folder in Drive → Share → add the GOOGLE_SERVICE_ACCOUNT_EMAIL as Viewer.'
    }
    return {
      id: 'drive_api',
      category: 'Integrations',
      name: 'Google Drive API',
      status: 'fail',
      message: msg,
      fix: { description: fix },
    }
  }
}

async function checkAnthropic(): Promise<HealthCheck> {
  const key = await getConfig('ANTHROPIC_API_KEY') ?? process.env.ANTHROPIC_API_KEY
  if (!key) {
    return {
      id: 'anthropic',
      category: 'Integrations',
      name: 'Anthropic API',
      status: 'warn',
      message: 'No ANTHROPIC_API_KEY — AI builders will return an error',
      fix: { description: 'Add ANTHROPIC_API_KEY to Vercel env vars.' },
    }
  }
  // Surface format only — don't burn tokens just to check
  if (!key.startsWith('sk-ant-')) {
    return {
      id: 'anthropic',
      category: 'Integrations',
      name: 'Anthropic API',
      status: 'warn',
      message: 'Key set but does not look like a valid Anthropic key (sk-ant-...)',
      fix: { description: 'Verify ANTHROPIC_API_KEY at https://console.anthropic.com/settings/keys' },
    }
  }
  return {
    id: 'anthropic',
    category: 'Integrations',
    name: 'Anthropic API',
    status: 'ok',
    message: 'Key set, looks valid',
  }
}

async function checkSlack(): Promise<HealthCheck> {
  const token = await getConfig('SLACK_BOT_TOKEN') ?? process.env.SLACK_BOT_TOKEN
  if (!token) {
    return {
      id: 'slack',
      category: 'Integrations',
      name: 'Slack Bot',
      status: 'warn',
      message: 'No SLACK_BOT_TOKEN — sync notifications + agent posts will fail',
      fix: { description: 'Add SLACK_BOT_TOKEN at /config or Vercel env vars.' },
    }
  }
  try {
    const client = await getSlackClient()
    const res = await client.auth.test()
    if (res.ok) {
      return {
        id: 'slack',
        category: 'Integrations',
        name: 'Slack Bot',
        status: 'ok',
        message: `Connected as ${res.user ?? '?'} in ${res.team ?? '?'}`,
      }
    }
    return {
      id: 'slack',
      category: 'Integrations',
      name: 'Slack Bot',
      status: 'fail',
      message: `auth.test failed: ${res.error ?? 'unknown'}`,
      fix: { description: 'Re-issue the token in your Slack app → OAuth & Permissions.' },
    }
  } catch (e) {
    return {
      id: 'slack',
      category: 'Integrations',
      name: 'Slack Bot',
      status: 'fail',
      message: e instanceof Error ? e.message : 'Auth test failed',
    }
  }
}

async function checkClients(): Promise<HealthCheck[]> {
  const supabase = createServerClient()
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, slug, name, drive_folder_id')
      .order('name')
    if (error || !clients) {
      return [
        {
          id: 'clients',
          category: 'Clients',
          name: 'Clients table',
          status: 'fail',
          message: error?.message ?? 'Unreachable',
          fix: { description: 'Run migration 008_client_performance.sql.' },
        },
      ]
    }
    if (clients.length === 0) {
      return [
        {
          id: 'clients_empty',
          category: 'Clients',
          name: 'Clients',
          status: 'info',
          message: 'No clients yet',
        },
      ]
    }

    const results: HealthCheck[] = []
    const ids = clients.map((c) => c.id)

    const { data: files } = await supabase
      .from('report_raw_files')
      .select('client_id, last_synced_at')
      .in('client_id', ids)
    const fileCount: Record<string, number> = {}
    const lastSync: Record<string, string | null> = {}
    for (const f of files ?? []) {
      fileCount[f.client_id] = (fileCount[f.client_id] ?? 0) + 1
      if (f.last_synced_at && (!lastSync[f.client_id] || f.last_synced_at > lastSync[f.client_id]!)) {
        lastSync[f.client_id] = f.last_synced_at
      }
    }

    const { data: kpis } = await supabase
      .from('report_kpis')
      .select('client_id')
      .in('client_id', ids)
    const kpiCount: Record<string, number> = {}
    for (const k of kpis ?? []) {
      if (k.client_id) kpiCount[k.client_id] = (kpiCount[k.client_id] ?? 0) + 1
    }

    for (const c of clients) {
      const fc = fileCount[c.id] ?? 0
      const kc = kpiCount[c.id] ?? 0
      const ls = lastSync[c.id] ?? null
      const ageMs = ls ? Date.now() - new Date(ls).getTime() : null
      const ageDays = ageMs != null ? Math.floor(ageMs / (24 * 60 * 60 * 1000)) : null

      let status: HealthStatus = 'ok'
      const issues: string[] = []
      if (!c.drive_folder_id) {
        status = 'warn'
        issues.push('no Drive folder')
      }
      if (fc === 0) {
        status = status === 'ok' ? 'warn' : status
        issues.push('0 files synced')
      }
      if (kc === 0) {
        status = status === 'ok' ? 'warn' : status
        issues.push('0 KPIs')
      }
      if (ageDays != null && ageDays >= 14) {
        status = 'warn'
        issues.push(`stale (${ageDays}d old)`)
      }

      const okLabel = ls
        ? `${fc} files · ${kc} KPIs · synced ${ageDays}d ago`
        : `${fc} files · ${kc} KPIs · never synced`

      // Pick the most useful single auto-fix for this client's worst issue
      let auto_fix: AutoFixAction | undefined
      let fixDescription = `Visit /clients and pick ${c.name} to address.`
      if (!c.drive_folder_id) {
        auto_fix = 'discover_drive_folders'
        fixDescription = `Try matching subfolders by name from the Drive parent (auto-discover).`
      } else if (fc === 0 || (ageDays != null && ageDays >= 14)) {
        auto_fix = 'sync_all_clients'
        fixDescription = `Run sync now for every connected client.`
      }

      results.push({
        id: `client_${c.slug}`,
        category: 'Clients',
        name: c.name,
        status,
        message: status === 'ok' ? okLabel : `${okLabel} — issues: ${issues.join(', ')}`,
        ...(status !== 'ok' && {
          fix: { description: fixDescription, auto_fix },
        }),
      })
    }

    return results
  } catch (e) {
    return [
      {
        id: 'clients',
        category: 'Clients',
        name: 'Clients',
        status: 'fail',
        message: e instanceof Error ? e.message : 'Check failed',
      },
    ]
  }
}

/* ──────────────────────────── orchestration ──────────────────────────── */

export async function runHealthChecks(): Promise<HealthReport> {
  const checks: HealthCheck[] = []

  // Environment
  checks.push(
    await checkEnvVar('NEXT_PUBLIC_SUPABASE_URL', { category: 'Environment' }),
    await checkEnvVar('SUPABASE_SERVICE_ROLE_KEY', { category: 'Environment' }),
    await checkEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', { category: 'Environment' }),
    await checkEnvVar('GOOGLE_SERVICE_ACCOUNT_EMAIL', { category: 'Environment' }),
    await checkEnvVar('GOOGLE_SERVICE_ACCOUNT_KEY', { category: 'Environment' }),
    await checkEnvVar('ANTHROPIC_API_KEY', { category: 'Environment', warnOnly: true, description: 'AI builders need this. Heuristic builders work without it.' }),
    await checkEnvVar('CRON_SECRET', { category: 'Environment', description: 'Required for the weekly sync cron to run.' }),
    await checkEnvVar('SLACK_BOT_TOKEN', { category: 'Environment', warnOnly: true, description: 'Required for Slack sync notifications.' }),
  )

  // Database — tables (migrations)
  checks.push(
    await checkTable('clients', 'Database', 'Run migration 008_client_performance.sql.'),
    await checkTable('report_raw_files', 'Database', 'Run migration 015_reporting.sql.'),
    await checkTable('report_kpis', 'Database', 'Run migration 015_reporting.sql.'),
    await checkTable('report_share_tokens', 'Database', 'Run migration 015_reporting.sql.'),
    await checkTable('report_views', 'Database', 'Run migration 016_reporting_v2.sql.'),
    await checkTable('app_config', 'Database', 'Run migration 010_app_config.sql.'),
  )

  // Database — columns added by migration 016
  checks.push(
    await checkColumn('clients', 'drive_folder_id', 'Database', '015_reporting.sql'),
    await checkColumn('report_kpis', 'compare_to', 'Database', '016_reporting_v2.sql'),
    await checkColumn('report_kpis', 'forecast_periods', 'Database', '016_reporting_v2.sql'),
    await checkColumn('report_kpis', 'group_by_column', 'Database', '016_reporting_v2.sql'),
  )

  // Integrations (skip if env not set so we don't spam errors)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    checks.push(await checkDriveAPI())
  }
  checks.push(await checkAnthropic())
  if ((await getConfig('SLACK_BOT_TOKEN')) || process.env.SLACK_BOT_TOKEN) {
    checks.push(await checkSlack())
  }

  // Configuration — reporting keys
  for (const key of Object.keys(REPORTING_CONFIG_DEFAULTS)) {
    checks.push(
      await checkConfigKey(
        key,
        'Reporting Config',
        REPORTING_CONFIG_DEFAULTS[key as keyof typeof REPORTING_CONFIG_DEFAULTS],
        // empty defaults (e.g. SYNC_NOTIFY_CHANNEL_ID) are warn-only, not fail
        REPORTING_CONFIG_DEFAULTS[key as keyof typeof REPORTING_CONFIG_DEFAULTS] === ''
      )
    )
  }

  // Configuration — branding keys
  for (const key of Object.keys(BRANDING_DEFAULTS)) {
    checks.push(
      await checkConfigKey(
        key,
        'Branding Config',
        BRANDING_DEFAULTS[key as keyof typeof BRANDING_DEFAULTS],
        true // branding always warn-only — defaults work
      )
    )
  }

  // Per-client health
  checks.push(...(await checkClients()))

  const summary = checks.reduce(
    (acc, c) => {
      acc[c.status] += 1
      return acc
    },
    { ok: 0, warn: 0, fail: 0, info: 0 } as Record<HealthStatus, number>
  )

  return {
    ran_at: new Date().toISOString(),
    checks,
    summary,
  }
}
