/**
 * App-level branding + display config. Read from app_config so admins can
 * change app name, footer, currency formatting, and accent color from the
 * Hardcoded tab without redeploying.
 */

import { getConfig, setConfig } from '@/lib/config'

export const BRANDING_DEFAULTS = {
  APP_NAME: 'Praxis',
  APP_FOOTER_PRIMARY: 'Built by Praxis',
  APP_FOOTER_SECONDARY: 'Internal Ops v1.0',
  KPI_CURRENCY_CODE: 'USD',
  KPI_CURRENCY_LOCALE: 'en-US',
  APP_DATE_LOCALE: 'en-US',
  APP_WEEK_START_DAY: '0', // 0=Sun, 1=Mon, … 6=Sat
  APP_ACCENT_HEX: '#f59e0b', // amber-500
} as const

export interface BrandingConfig {
  app_name: string
  app_footer_primary: string
  app_footer_secondary: string
  kpi_currency_code: string
  kpi_currency_locale: string
  app_date_locale: string
  /** 0=Sun … 6=Sat. Used by calendar / week-start logic. */
  app_week_start_day: number
  app_accent_hex: string
}

export async function getBrandingConfig(): Promise<BrandingConfig> {
  const [name, footerP, footerS, code, currencyLocale, dateLocale, weekStart, accent] =
    await Promise.all([
      getConfig('APP_NAME'),
      getConfig('APP_FOOTER_PRIMARY'),
      getConfig('APP_FOOTER_SECONDARY'),
      getConfig('KPI_CURRENCY_CODE'),
      getConfig('KPI_CURRENCY_LOCALE'),
      getConfig('APP_DATE_LOCALE'),
      getConfig('APP_WEEK_START_DAY'),
      getConfig('APP_ACCENT_HEX'),
    ])
  return {
    app_name: (name && name.trim()) || BRANDING_DEFAULTS.APP_NAME,
    app_footer_primary: (footerP && footerP.trim()) || BRANDING_DEFAULTS.APP_FOOTER_PRIMARY,
    app_footer_secondary: (footerS && footerS.trim()) || BRANDING_DEFAULTS.APP_FOOTER_SECONDARY,
    kpi_currency_code: validCurrencyCode(code) || BRANDING_DEFAULTS.KPI_CURRENCY_CODE,
    kpi_currency_locale: validLocale(currencyLocale) || BRANDING_DEFAULTS.KPI_CURRENCY_LOCALE,
    app_date_locale:
      validLocale(dateLocale) ||
      validLocale(currencyLocale) ||
      BRANDING_DEFAULTS.APP_DATE_LOCALE,
    app_week_start_day: validWeekStart(weekStart),
    app_accent_hex: validHex(accent) || BRANDING_DEFAULTS.APP_ACCENT_HEX,
  }
}

function validCurrencyCode(s: string | null | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : null
}

function validLocale(s: string | null | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim()
  // Loose check: en-US, en-GB, fr-FR, ja-JP, zh-Hant-TW etc.
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(trimmed) ? trimmed : null
}

function validWeekStart(s: string | null | undefined): number {
  const fallback = Number(BRANDING_DEFAULTS.APP_WEEK_START_DAY)
  if (s == null) return fallback
  const n = Number(String(s).trim())
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : fallback
}

function validHex(s: string | null | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null
}

/** Seed any missing branding config keys with their defaults. Idempotent. */
export async function seedBrandingDefaults(userId?: string): Promise<void> {
  for (const [key, value] of Object.entries(BRANDING_DEFAULTS)) {
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
