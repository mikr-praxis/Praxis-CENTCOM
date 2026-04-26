'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { BrandingConfig } from '@/lib/branding'

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

/**
 * Hook returning the active branding config. Falls back to safe defaults if
 * the provider is missing (so legacy components keep rendering).
 */
export function useBranding(): BrandingConfig {
  const ctx = useContext(BrandingContext)
  return (
    ctx ?? {
      app_name: 'Praxis',
      app_footer_primary: 'Built by Praxis',
      app_footer_secondary: 'Internal Ops v1.0',
      kpi_currency_code: 'USD',
      kpi_currency_locale: 'en-US',
      app_accent_hex: '#f59e0b',
    }
  )
}
