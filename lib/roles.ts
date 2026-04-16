/**
 * Role-based permission system for Praxis CentCom.
 *
 * Current policy (Option A collapse): every authorized user is 'exec'.
 * The Role type and route permissions are kept intact so we can reintroduce
 * tiers later without re-architecting. 'am' and 'cs' are unused at runtime.
 *
 * Authorization:
 *   - Any @builtbypraxis.com email â exec
 *   - michael.nield7@gmail.com     â exec
 *   - Everything else              â 'cs' (unreachable â the (app) layout
 *                                    redirects non-exec users to /unauthorized)
 */

export type Role = 'exec' | 'am' | 'cs'

export type RoutePermission = {
  href: string
  /** Which roles can see / access this route */
  roles: Role[]
}

// ââ Authorized individual emails (outside @builtbypraxis.com) ââââââââââ
const AUTHORIZED_PERSONAL_EMAILS: ReadonlySet<string> = new Set([
  'michael.nield7@gmail.com',
])

/**
 * Whether this email is authorized to access CENTCOM at all.
 * Mirrored by the (app) layout gate.
 */
export function isAuthorizedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  if (normalized.endsWith('@builtbypraxis.com')) return true
  return AUTHORIZED_PERSONAL_EMAILS.has(normalized)
}

/**
 * Resolve a role from an email address.
 * Authorized emails â 'exec'. Everyone else â 'cs' (blocked upstream).
 */
export function getRoleFromEmail(email: string | null | undefined): Role {
  return isAuthorizedEmail(email) ? 'exec' : 'cs'
}

// ââ Route permissions âââââââââââââââââââââââââââââââââââââââââââââââââââ
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  { href: '/dashboard', roles: ['exec', 'am', 'cs'] },
  { href: '/projects',  roles: ['exec', 'am'] },
  { href: '/tasks',     roles: ['exec', 'am', 'cs'] },
  { href: '/monday',    roles: ['exec', 'am'] },
  { href: '/calendar',  roles: ['exec', 'am', 'cs'] },
  { href: '/events',    roles: ['exec', 'am', 'cs'] },
  { href: '/budget',    roles: ['exec'] },
  { href: '/comms',     roles: ['exec', 'am', 'cs'] },
  { href: '/agents',    roles: ['exec'] },
  { href: '/memory',    roles: ['exec'] },
  { href: '/config',    roles: ['exec'] },
]

/** Check if a role can access a given pathname */
export function canAccess(role: Role, pathname: string): boolean {
  const match = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.href))
  if (!match) return true // unknown routes are open (404 will handle)
  return match.roles.includes(role)
}

/** Get all routes a role can access */
export function getAccessibleRoutes(role: Role): string[] {
  return ROUTE_PERMISSIONS.filter((r) => r.roles.includes(role)).map((r) => r.href)
}

/** Human-readable role labels */
export const ROLE_LABELS: Record<Role, string> = {
  exec: 'Executive',
  am: 'Account Manager',
  cs: 'Customer Success',
}

/** Role badge colors (tailwind classes) */
export const ROLE_COLORS: Record<Role, string> = {
  exec: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  am: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  cs: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
}
