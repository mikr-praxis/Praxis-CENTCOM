import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { getBrandingConfig } from '@/lib/branding'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export async function generateMetadata(): Promise<Metadata> {
  // Best-effort: if config read fails (e.g. missing env at build time), fall
  // back to defaults from BRANDING_DEFAULTS.
  try {
    const b = await getBrandingConfig()
    return {
      title: `${b.app_name} — ${b.app_footer_secondary}`,
      description: `${b.app_footer_secondary} dashboard for ${b.app_footer_primary}`,
    }
  } catch {
    return {
      title: 'Praxis — Internal Ops',
      description: 'Internal operations dashboard',
    }
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read accent so the Clerk modal + global CSS var both reflect the configured color.
  let accent = '#f59e0b'
  try {
    const b = await getBrandingConfig()
    accent = b.app_accent_hex
  } catch {
    /* fall back to amber */
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: accent,
          colorBackground: '#1e293b',
          colorText: '#e2e8f0',
          colorInputBackground: '#0f172a',
          colorInputText: '#e2e8f0',
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        style={{ ['--accent' as string]: accent }}
      >
        <body className="min-h-full bg-slate-950">{children}</body>
      </html>
    </ClerkProvider>
  )
}
