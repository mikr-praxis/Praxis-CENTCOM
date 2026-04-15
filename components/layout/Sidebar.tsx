'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CalendarDays,
  DollarSign,
  MessageSquare,
  Bot,
  Brain,
  FolderKanban,
  Settings,
  Zap,
  Columns3,
} from 'lucide-react'
import { useRole } from '@/components/providers/RoleProvider'
import { ROUTE_PERMISSIONS } from '@/lib/roles'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Monday', href: '/monday', icon: Columns3 },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Budget', href: '/budget', icon: DollarSign },
  { name: 'Comms', href: '/comms', icon: MessageSquare },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Memory', href: '/memory', icon: Brain },
  { name: 'Config', href: '/config', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { role } = useRole()

  // Filter navigation to only show routes the current role can access
  const visibleNav = navigation.filter((item) => {
    const perm = ROUTE_PERMISSIONS.find((r) => item.href.startsWith(r.href))
    return !perm || perm.roles.includes(role)
  })

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow bg-slate-900 border-r border-slate-700/50 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-6">
            <Zap className="h-8 w-8 text-amber-400" />
            <span className="ml-3 text-xl font-bold text-white tracking-tight">Praxis</span>
          </div>
          <nav className="mt-8 flex-1 px-3 space-y-1">
            {visibleNav.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  )}
                >
                  <item.icon
                    className={clsx(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="px-6 py-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-500">Built by Praxis</p>
            <p className="text-xs text-slate-600">Internal Ops v1.0</p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav — scrollable with safe area insets */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center h-16 px-1 overflow-x-auto scrollbar-hide gap-0.5">
          {visibleNav.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center min-w-[48px] min-h-[48px] rounded-xl text-xs flex-shrink-0 px-1.5 active:scale-95 transition-transform',
                  isActive ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 active:text-slate-300'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="mt-0.5 text-[9px] font-medium leading-tight">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
