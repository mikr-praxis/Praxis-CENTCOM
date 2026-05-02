'use client'

/**
 * Production-readiness banner. Renders ONLY when the live Clerk publishable key
 * starts with `pk_test_` (Clerk's development-instance prefix). Dev keys have
 * strict usage caps and aren't backed by Clerk's production SLAs, so leaving
 * them in production silently is dangerous.
 *
 * Why client-side: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is exposed to the browser
 * by design, so we can read it at render time without a server round-trip.
 */

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

const DISMISS_KEY = 'praxis:dev-keys-banner:dismissed'

export function DevKeysBanner() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const isDevKey = pk.startsWith('pk_test_')
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (!isDevKey || dismissed) return null

  return (
    <div className="sticky top-0 z-40 bg-red-500/15 border-b border-red-500/40 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
        <div className="flex-1 text-xs sm:text-sm text-red-100">
          <span className="font-semibold">Production using Clerk dev keys.</span>{' '}
          <span className="text-red-200/80">
            Dev instances have strict caps and can be revoked. Promote to a Clerk production instance
            and swap{' '}
            <code className="px-1 rounded bg-red-950/40 font-mono text-red-100">
              NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            </code>{' '}
            +{' '}
            <code className="px-1 rounded bg-red-950/40 font-mono text-red-100">
              CLERK_SECRET_KEY
            </code>{' '}
            in Vercel.
          </span>
        </div>
        <a
          href="https://clerk.com/docs/deployments/overview"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-100 border border-red-500/40"
        >
          Clerk docs →
        </a>
        <button
          onClick={() => {
            setDismissed(true)
            try {
              window.sessionStorage.setItem(DISMISS_KEY, '1')
            } catch {
              /* private mode — silently no-op */
            }
          }}
          className="p-1 rounded hover:bg-red-500/20 text-red-300 hover:text-red-100"
          aria-label="Dismiss for this session"
          title="Dismiss until next reload"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
