import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getRoleFromEmail, canAccess, type Role } from './roles'

/**
 * Get the current user's role from their Clerk email.
 * Use in Server Components, Route Handlers, and Server Actions.
 */
export async function getUserRole(): Promise<{ userId: string; role: Role; email: string } | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  if (!user) return null

  const email = user.emailAddresses?.[0]?.emailAddress ?? null
  const role = getRoleFromEmail(email)

  return { userId, role, email: email ?? '' }
}

/**
 * Require a specific set of roles to access a page.
 * Redirects to /dashboard if the user doesn't have permission.
 * Returns the userId and role for further use.
 */
export async function requireRole(
  pathname: string
): Promise<{ userId: string; role: Role; email: string }> {
  const userInfo = await getUserRole()
  if (!userInfo) redirect('/sign-in')
  if (!canAccess(userInfo.role, pathname)) redirect('/dashboard')
  return userInfo
}
