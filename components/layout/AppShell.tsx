'use client'

import { usePathname } from 'next/navigation'
import { ViewProvider } from '@/lib/views/context'
import { ViewSwitcher } from '@/components/views/ViewSwitcher'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideViewSwitcher = pathname === '/projects'

  return (
    <ViewProvider>
      <div className="space-y-4">
        {!hideViewSwitcher && <ViewSwitcher />}
        {children}
      </div>
    </ViewProvider>
  )
}
