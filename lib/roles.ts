/**
 * Role-based permission system for Praxis CentCom.
 *
 * Three roles:
 *   exec  – full access to everything (co-founders)
 *   am    – account managers: projects, tasks, calendar, events, comms
 *   cs    – customer success: tasks, calendar, events, comms
 *
 * Role is resolved from the Clerk user's primary email address.
 * Unknown emails default to 'cs' (most restricted).
 */

export type Role = 'exec' | 'am' | 'cs'

export type RoutePermission = {
  href: string
  /** Which roles can see / access this route */
  roles: Role[]
}

// ── Email → Role mapping ────────────────────────────────────────────────
// Add new team members here when they join.
const EMAIL_ROLE_MAP: Record<string, Role> = {
  'mscott@builtbypraxis.com': 'exec',
  'nadeem@builtbypraxis.com': 'exec',
  'kevin@builtbypraxis.com': 'exec',
  'derek@builtbypraxis.com': 'exec',
  'hillary@builtbypraxis.com': 'am',
  'victoria@builtbypraxis.com': 'cs',
}

/** Resolve a role from an email address. Defaults to 'cs'. */
export function getRoleFromEmail(email: string | null | undefined): Role {
  if (!email) return 'cs'
  return EMAIL_ROLE_MAP[email.toLowerCase().trim()] ?? 'cs'
}

// ── Route permissions ───────────────────────────────────────────────────
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
