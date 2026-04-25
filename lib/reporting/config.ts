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
