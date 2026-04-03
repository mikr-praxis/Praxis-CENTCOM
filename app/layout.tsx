import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Praxis — Internal Ops',
  description: 'Internal operations dashboard for Built by Praxis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#f59e0b',
          colorBackground: '#1e293b',
          colorText: '#e2e8f0',
          colorInputBackground: '#0f172a',
          colorInputText: '#e2e8f0',
        },
      }}
    >
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full bg-slate-950">{children}</body>
      </html>
    </ClerkProvider>
  )
}
