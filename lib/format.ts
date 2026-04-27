/**
 * Locale-aware formatting helpers. Single source of truth for date/time/number/currency
 * formatting across server and client code.
 *
 * Server: pass the resolved BrandingConfig (or just the locale strings) directly.
 * Client: use the `useFormatters()` hook from `@/components/providers/BrandingProvider`,
 * which binds these helpers to the active branding context.
 *
 * Why this exists: previously every file hard-coded `'en-US'` in
 * `toLocaleDateString` / `Intl.NumberFormat`, so a non-US client got mixed
 * formatting depending on which component rendered the value. These helpers
 * centralize the locale lookup.
 */

import { BRANDING_DEFAULTS, type BrandingConfig } from './branding'

export type DateInput = Date | string | number

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input)
}

/**
 * Format a date with the given locale + options. The `locale` argument should
 * be a BCP-47 string (e.g. `'en-US'`, `'fr-FR'`); the function never throws on
 * an unknown locale because Intl falls back to the runtime default.
 */
export function formatDate(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = BRANDING_DEFAULTS.APP_DATE_LOCALE
): string {
  return toDate(input).toLocaleDateString(locale, options)
}

export function formatTime(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true },
  locale: string = BRANDING_DEFAULTS.APP_DATE_LOCALE
): string {
  return toDate(input).toLocaleTimeString(locale, options)
}

export function formatDateTime(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },
  locale: string = BRANDING_DEFAULTS.APP_DATE_LOCALE
): string {
  return toDate(input).toLocaleString(locale, options)
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: string = BRANDING_DEFAULTS.APP_DATE_LOCALE
): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatCurrency(
  value: number,
  currencyCode: string = BRANDING_DEFAULTS.KPI_CURRENCY_CODE,
  locale: string = BRANDING_DEFAULTS.KPI_CURRENCY_LOCALE,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 0 }
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    ...options,
  }).format(value)
}

/**
 * Bound formatter set. Use this on the server when you already have a resolved
 * BrandingConfig — saves passing locale to every call site.
 */
export interface BoundFormatters {
  date: (d: DateInput, opts?: Intl.DateTimeFormatOptions) => string
  time: (d: DateInput, opts?: Intl.DateTimeFormatOptions) => string
  dateTime: (d: DateInput, opts?: Intl.DateTimeFormatOptions) => string
  number: (n: number, opts?: Intl.NumberFormatOptions) => string
  currency: (n: number, opts?: Intl.NumberFormatOptions) => string
  weekStartDay: number
  dateLocale: string
  currencyLocale: string
  currencyCode: string
}

export function getBoundFormatters(branding: BrandingConfig): BoundFormatters {
  const dateLocale = branding.app_date_locale || BRANDING_DEFAULTS.APP_DATE_LOCALE
  const currencyLocale = branding.kpi_currency_locale || BRANDING_DEFAULTS.KPI_CURRENCY_LOCALE
  const currencyCode = branding.kpi_currency_code || BRANDING_DEFAULTS.KPI_CURRENCY_CODE
  return {
    date: (d, opts) => formatDate(d, opts, dateLocale),
    time: (d, opts) => formatTime(d, opts, dateLocale),
    dateTime: (d, opts) => formatDateTime(d, opts, dateLocale),
    number: (n, opts) => formatNumber(n, opts, dateLocale),
    currency: (n, opts) =>
      formatCurrency(n, currencyCode, currencyLocale, { maximumFractionDigits: 0, ...opts }),
    weekStartDay: branding.app_week_start_day ?? Number(BRANDING_DEFAULTS.APP_WEEK_START_DAY),
    dateLocale,
    currencyLocale,
    currencyCode,
  }
}
