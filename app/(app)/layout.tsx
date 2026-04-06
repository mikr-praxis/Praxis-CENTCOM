import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { AppShell } from '@/components/layout/AppShell'
import { DeployStatus } from '@/components/ui/DeployStatus'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="md:pl-64">
        <TopBar />
        <main className="p-4 pb-28 md:p-6 md:pb-6">
          <AppShell>{children}</AppShell>
        </main>
      </div>
      <DeployStatus />
    </div>
  )
}
