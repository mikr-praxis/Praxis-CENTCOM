'use client'

import { ViewProvider } from '@/lib/views/context'
import { ViewSwitcher } from '@/components/views/ViewSwitcher'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ViewProvider>
      <div className="space-y-4">
        <ViewSwitcher />
        {children}
      </div>
    </ViewProvider>
  )
}
