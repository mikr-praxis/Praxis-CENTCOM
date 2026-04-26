'use client'

import { UserButton } from '@clerk/nextjs'
import { Bell } from 'lucide-react'
import { useRole } from '@/components/providers/RoleProvider'
import { useBranding } from '@/components/providers/BrandingProvider'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/roles'

export function TopBar() {
  const { role } = useRole()
  const branding = useBranding()

  return (
    <header className="sticky top-0 z-40 flex h-14 md:h-16 items-center justify-between border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md px-4 md:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-slate-100 md:hidden">{branding.app_name}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className={`hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${ROLE_COLORS[role]}`}>
          {ROLE_LABELS[role]}
        </span>
        <button className="relative rounded-xl p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 active:scale-95 transition-all">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500" />
        </button>
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-9 w-9',
            },
          }}
        />
      </div>
    </header>
  )
}
