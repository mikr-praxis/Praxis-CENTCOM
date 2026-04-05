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
  FolderKanban,
  Settings,
  Zap,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Budget', href: '/budget', icon: DollarSign },
  { name: 'Comms', href: '/comms', icon: MessageSquare },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Config', href: '/config', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

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
            {navigation.map((item) => {
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

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700/50 z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-xs',
                  isActive ? 'text-amber-400' : 'text-slate-500'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="mt-1 text-[10px]">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
