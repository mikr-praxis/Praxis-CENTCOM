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
  // 'data_30d' = last 30 days OF DATA (relative to most recent row in the
  // synced files), not last 30 calendar days. Keeps tiles populated for clients
  // whose data isn't live-streaming.
  REPORTING_DEFAULT_TIMEFRAME: 'data_30d',
  REPORTING_GRANULARITY_THRESHOLDS_JSON: '{"day_max":14,"week_max":120}',
  REPORTING_SYNC_NOTIFY_CHANNEL_ID: '',
  SHARE_TOKEN_DEFAULT_EXPIRY_DAYS: '30',
  REPORTING_DEFAULT_FUNNEL_TYPE: 'call',
  REPORTING_DATE_PARSE_THRESHOLD: '0.3',
  REPORTING_FORECAST_DEFAULT_METHOD: 'linear',
  REPORTING_FORECAST_DEFAULT_PERIODS: '0',
  WEEKLY_SYNC_DAY_OF_WEEK: '0', // 0 = Sunday … 6 = Saturday (UTC)
  WEEKLY_SYNC_HOUR_UTC: '3',
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
  return 'data_30d'
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

export type FunnelType = 'call' | 'webinar' | 'challenge'

export async function getReportingDefaultFunnelType(): Promise<FunnelType> {
  const v = (await getConfig('REPORTING_DEFAULT_FUNNEL_TYPE'))?.trim().toLowerCase()
  if (v === 'webinar' || v === 'challenge') return v
  return 'call'
}

/**
 * Minimum ratio of parseable-date values a column needs to qualify as the
 * primary date column for a file. 0.3 (30%) by default — lower if you have
 * sparse data (lots of optional dates), higher to require dense date columns.
 * Clamped to [0, 1].
 */
export async function getReportingDateParseThreshold(): Promise<number> {
  const v = await getConfig('REPORTING_DATE_PARSE_THRESHOLD')
  const n = Number(v ?? '')
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.3
  return n
}

export type ForecastMethod = 'linear' | 'moving_avg'

export async function getReportingForecastDefaultMethod(): Promise<ForecastMethod> {
  const v = (await getConfig('REPORTING_FORECAST_DEFAULT_METHOD'))?.trim().toLowerCase()
  return v === 'moving_avg' ? 'moving_avg' : 'linear'
}

export async function getReportingForecastDefaultPeriods(): Promise<number> {
  const v = await getConfig('REPORTING_FORECAST_DEFAULT_PERIODS')
  const n = Number(v ?? '')
  if (!Number.isFinite(n) || n < 0 || n > 52) return 0
  return Math.floor(n)
}

/**
 * Day-of-week (UTC) the weekly sync should actually run. 0 = Sunday … 6 = Saturday.
 * Vercel cron fires daily; the route uses this + WEEKLY_SYNC_HOUR_UTC to decide
 * whether the current invocation is the right slot to do work.
 */
export async function getWeeklySyncDayOfWeek(): Promise<number> {
  const v = await getConfig('WEEKLY_SYNC_DAY_OF_WEEK')
  const n = Number(v ?? '')
  if (!Number.isFinite(n) || n < 0 || n > 6) return 0
  return Math.floor(n)
}

/** Hour of day (UTC, 0–23) the weekly sync should run. */
export async function getWeeklySyncHourUtc(): Promise<number> {
  const v = await getConfig('WEEKLY_SYNC_HOUR_UTC')
  const n = Number(v ?? '')
  if (!Number.isFinite(n) || n < 0 || n > 23) return 3
  return Math.floor(n)
}

/** Human-readable label for the active weekly slot. */
export async function describeWeeklySyncSlot(): Promise<string> {
  const day = await getWeeklySyncDayOfWeek()
  const hour = await getWeeklySyncHourUtc()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
  return `${dayName} ${String(hour).padStart(2, '0')}:00 UTC`
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
