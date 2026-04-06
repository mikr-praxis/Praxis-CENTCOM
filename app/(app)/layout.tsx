import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { AppShell } from '@/components/layout/AppShell'
import { DeployStatus } from '@/components/ui/DeployStatus'
import { RoleProvider } from '@/components/providers/RoleProvider'
import { getUserRole } from '@/lib/auth'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userInfo = await getUserRole()
  const role = userInfo?.role ?? 'cs'
  const email = userInfo?.email ?? ''

  return (
    <RoleProvider role={role} email={email}>
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
    </RoleProvider>
  )
}
