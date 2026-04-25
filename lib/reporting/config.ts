/**
 * Reporting module configuration helpers. Reads from app_config (with
 * sensible fallbacks) so admins can tune behavior from the Hardcoded tab
 * without redeploying.
 */

import { getConfig, setConfig } from '@/lib/config'

export const REPORTING_CONFIG_DEFAULTS = {
  DRIVE_REPORTS_PARENT_FOLDER_ID: '1klkR5cDPfJggoblpYNqbsky4F6l2aeMG',
  REPORTING_AI_MODEL: 'claude-opus-4-6',
  REPORTING_AI_MAX_TOKENS: '6000',
  REPORTING_DEFAULT_KPI_COUNT: '6',
  WEEKLY_SYNC_ENABLED: 'true',
  REPORTING_MAX_CACHED_ROWS: '50000',
  REPORTING_TOP_VALUES_PER_COLUMN: '30',
  REPORTING_DEFAULT_TIMEFRAME: '30d',
  REPORTING_GRANULARITY_THRESHOLDS_JSON: '{"day_max":14,"week_max":120}',
  REPORTING_SYNC_NOTIFY_CHANNEL_ID: '',
  SHARE_TOKEN_DEFAULT_EXPIRY_DAYS: '30',
} as const

export type ReportingConfigKey = keyof typeof REPORTING_CONFIG_DEFAULTS

export async function getReportingDriveParentFolderId(): Promise<string | null> {
  const v = await getConfig('DRIVE_REPORTS_PARENT_FOLDER_ID')
  if (v && v.trim()) return v.trim()
  return REPORTING_CONFIG_DEFAULTS.DRIVE_REPORTS_PARENT_FOLDER_ID || null
}

export async function getReportingAIModel(): Promise<string> {
  const v = await getConfig('REPORTING_AI_MODEL')
  return (v && v.trim()) || REPORTING_CONFIG_DEFAULTS.REPORTING_AI_MODEL
}

export async function getReportingAIMaxTokens(fallback: number = 6000): Promise<number> {
  const v = await getConfig('REPORTING_AI_MAX_TOKENS')
  const n = Number(v ?? '')
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function getReportingDefaultKPICount(): Promise<number> {
  const v = await getConfig('REPORTING_DEFAULT_KPI_COUNT')
  const n = Number(v ?? '')
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 6
}

export async function isWeeklySyncEnabled(): Promise<boolean> {
  const v = await getConfig('WEEKLY_SYNC_ENABLED')
  if (v == null) return REPORTING_CONFIG_DEFAULTS.WEEKLY_SYNC_ENABLED === 'true'
  return /^(true|1|yes|on)$/i.test(v.trim())
}

export async function getReportingMaxCachedRows(): Promise<number> {
  const v = await getConfig('REPORTING_MAX_CACHED_ROWS')
  const n = Number(v ?? '')
  return Number.isFinite(n) && n > 0 ? n : 50_000
}

export async function getReportingTopValuesPerColumn(): Promise<number> {
  const v = await getConfig('REPORTING_TOP_VALUES_PER_COLUMN')
  const n = Number(v ?? '')
  return Number.isFinite(n) && n > 0 ? n : 30
}

export async function getReportingDefaultTimeframe(): Promise<string> {
  const v = await getConfig('REPORTING_DEFAULT_TIMEFRAME')
  const valid = ['7d', '30d', '90d', 'qtd', 'ytd', 'all', 'data_7d', 'data_30d', 'data_90d', 'data_all']
  if (v && valid.includes(v.trim())) return v.trim()
  return '30d'
}

export async function getReportingSyncNotifyChannelId(): Promise<string | null> {
  const v = await getConfig('REPORTING_SYNC_NOTIFY_CHANNEL_ID')
  return v && v.trim() ? v.trim() : null
}

/**
 * How many days a freshly-generated share token lives by default. Returns 0
 * for "never expires" (any non-positive number is treated as no-expiry).
 */
export async function getShareTokenDefaultExpiryDays(): Promise<number> {
  const v = await getConfig('SHARE_TOKEN_DEFAULT_EXPIRY_DAYS')
  const n = Number(v ?? '')
  if (!Number.isFinite(n) || n < 0) return 30
  return n
}

export interface GranularityThresholds {
  /** ≤ this many days → daily buckets */
  day_max: number
  /** ≤ this many days → weekly buckets; > → monthly */
  week_max: number
}

export async function getReportingGranularityThresholds(): Promise<GranularityThresholds> {
  const v = await getConfig('REPORTING_GRANULARITY_THRESHOLDS_JSON')
  if (v) {
    try {
      const parsed = JSON.parse(v)
      if (typeof parsed.day_max === 'number' && typeof parsed.week_max === 'number') {
        return { day_max: parsed.day_max, week_max: parsed.week_max }
      }
    } catch {
      /* fall through to default */
    }
  }
  return { day_max: 14, week_max: 120 }
}

/**
 * Seed any missing reporting config keys with their defaults. Idempotent —
 * existing values are never overwritten. Best-effort; swallows errors.
 */
export async function seedReportingConfigDefaults(userId?: string): Promise<void> {
  for (const [key, value] of Object.entries(REPORTING_CONFIG_DEFAULTS)) {
    try {
      const existing = await getConfig(key)
      if (existing == null) {
        await setConfig(key, value, userId)
      }
    } catch {
      /* ignore */
    }
  }
}
