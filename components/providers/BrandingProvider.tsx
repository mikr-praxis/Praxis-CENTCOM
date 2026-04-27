'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { BrandingConfig } from '@/lib/branding'
import { BRANDING_DEFAULTS } from '@/lib/branding'
import { getBoundFormatters, type BoundFormatters } from '@/lib/format'

const BrandingContext = createContext<BrandingConfig | null>(null)

interface Props {
  value: BrandingConfig
  children: ReactNode
}

export function BrandingProvider({ value, children }: Props) {
  return (
    <BrandingContext.Provider value={value}>
      {/* CSS custom property exposed app-wide for arbitrary-value Tailwind classes
          (e.g. bg-[color:var(--accent)]) and any inline-styled elements. */}
      <div style={{ '--accent': value.app_accent_hex } as React.CSSProperties} className="contents">
        {children}
      </div>
    </BrandingContext.Provider>
  )
}

const FALLBACK: BrandingConfig = {
  app_name: BRANDING_DEFAULTS.APP_NAME,
  app_footer_primary: BRANDING_DEFAULTS.APP_FOOTER_PRIMARY,
  app_footer_secondary: BRANDING_DEFAULTS.APP_FOOTER_SECONDARY,
  kpi_currency_code: BRANDING_DEFAULTS.KPI_CURRENCY_CODE,
  kpi_currency_locale: BRANDING_DEFAULTS.KPI_CURRENCY_LOCALE,
  app_date_locale: BRANDING_DEFAULTS.APP_DATE_LOCALE,
  app_week_start_day: Number(BRANDING_DEFAULTS.APP_WEEK_START_DAY),
  app_accent_hex: BRANDING_DEFAULTS.APP_ACCENT_HEX,
}

/**
 * Hook returning the active branding config. Falls back to safe defaults if
 * the provider is missing (so legacy components keep rendering).
 */
export function useBranding(): BrandingConfig {
  return useContext(BrandingContext) ?? FALLBACK
}

/**
 * Hook returning locale-bound formatter helpers. Prefer this in client
 * components instead of calling `toLocaleDateString('en-US', …)` directly,
 * so the user's configured locale takes effect everywhere.
 */
export function useFormatters(): BoundFormatters {
  const branding = useBranding()
  // Memoize so the bound functions are referentially stable across renders.
  return useMemo(() => getBoundFormatters(branding), [branding])
}
