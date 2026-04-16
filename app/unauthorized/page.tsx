import Link from 'next/link'
import { SignOutButton } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import { Zap, ShieldAlert } from 'lucide-react'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function UnauthorizedPage() {
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? 'your account'
  const supportEmail = await getConfig('SUPPORT_EMAIL') || 'mscott@builtbypraxis.com'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="h-6 w-6 text-amber-400" />
          <span className="text-lg font-bold text-white tracking-tight">Praxis</span>
        </div>

        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 rounded-full bg-amber-500/15 p-2 border border-amber-500/20">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Access not authorized</h1>
            <p className="mt-1 text-sm text-slate-400">
              CENTCOM is restricted to Built by Praxis staff.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-slate-950/60 border border-slate-800 p-4 text-sm">
          <div className="text-slate-500">Signed in as</div>
          <div className="mt-0.5 font-mono text-slate-200 break-all">{email}</div>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          If you believe you should have access, reach out to{' '}
          <a
            href={`mailto:${supportEmail}`}
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            {supportEmail}
          </a>
          .
        </p>

        <div className="mt-8 flex items-center gap-3">
          <SignOutButton redirectUrl="/sign-in">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 transition-colors"
            >
              Sign out
            </button>
          </SignOutButton>
          <Link
            href="/sign-in"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Try another account
          </Link>
        </div>
      </div>
    </div>
  )
}
