import { UserButton } from '@clerk/nextjs'
import { Bell } from 'lucide-react'

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-100 md:hidden">Praxis</h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
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
