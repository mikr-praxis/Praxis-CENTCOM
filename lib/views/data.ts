// Team members, groups, and tags — reads from app_config with hardcoded defaults.
// Edit via /config page (keys: TEAM_MEMBERS_JSON, GROUPS_JSON, TAG_CATEGORIES_JSON)

import { getConfig } from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────
export type TeamMember = {
  id: string
  name: string
  calendarEmail: string
  role: string
  group: string
  avatar: string
}

export type Group = {
  id: string
  name: string
  description: string
  color: string
  members: string[]
}

export type Tag = { id: string; label: string }
export type TagCategory = {
  id: string
  name: string
  color: string
  tags: Tag[]
}

// ── Defaults (used when app_config has no override) ───────────────────

const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  { id: 'nadeem', name: 'Nadeem', calendarEmail: 'nadeem@builtbypraxis.com', role: 'Co-Founder', group: 'exec', avatar: '🟠' },
  { id: 'derek', name: 'Derek', calendarEmail: 'derek@builtbypraxis.com', role: 'Co-Founder', group: 'exec', avatar: '🔵' },
  { id: 'kevin', name: 'Kevin', calendarEmail: 'kevin@builtbypraxis.com', role: 'Co-Founder', group: 'exec', avatar: '🟢' },
  { id: 'mike', name: 'Mike', calendarEmail: 'mscott@builtbypraxis.com', role: 'Data & Ops', group: 'data-analyst', avatar: '🟣' },
]

const DEFAULT_GROUPS: Group[] = [
  { id: 'exec', name: 'Exec', description: 'Executive leadership', color: 'amber', members: ['nadeem', 'derek', 'kevin'] },
  { id: 'account-manager', name: 'Account Manager', description: 'Client relationship management', color: 'blue', members: ['derek'] },
  { id: 'marketing-manager', name: 'Marketing Manager', description: 'Paid media & funnel strategy', color: 'green', members: ['kevin'] },
  { id: 'data-analyst', name: 'Data Analyst', description: 'Data, ops & automation', color: 'purple', members: ['mike'] },
  { id: 'event-coordinator', name: 'Event Coordinator', description: 'Event planning & execution', color: 'rose', members: ['nadeem', 'derek'] },
]

const DEFAULT_TAG_CATEGORIES: TagCategory[] = [
  {
    id: 'client', name: 'Client Tags', color: 'cyan',
    tags: [
      { id: 'breathe-for-change', label: 'Breathe for Change' },
      { id: 'mantalks', label: 'ManTalks' },
      { id: 'john-wineland', label: 'John Wineland' },
      { id: 'soma-plus-iq', label: 'Soma Plus IQ' },
      { id: 'krista-mishore', label: 'Krista Mishore' },
    ],
  },
  {
    id: 'state', name: 'State Tags', color: 'emerald',
    tags: [
      { id: 'active', label: 'Active' },
      { id: 'onboarding', label: 'Onboarding' },
      { id: 'paused', label: 'Paused' },
      { id: 'completed', label: 'Completed' },
    ],
  },
  {
    id: 'event', name: 'Event Tags', color: 'violet',
    tags: [
      { id: 'virtual', label: 'Virtual' },
      { id: 'in-person', label: 'In-Person' },
      { id: 'workshop', label: 'Workshop' },
      { id: 'masterclass', label: 'Masterclass' },
    ],
  },
  {
    id: 'importance', name: 'Importance Tags', color: 'rose',
    tags: [
      { id: 'critical', label: 'Critical' },
      { id: 'high', label: 'High' },
      { id: 'medium', label: 'Medium' },
      { id: 'low', label: 'Low' },
    ],
  },
]

// ── Runtime cache ─────────────────────────────────────────────────────
let _teamMembers: TeamMember[] | null = null
let _groups: Group[] | null = null
let _tagCategories: TagCategory[] | null = null
let _viewsLoadedAt = 0
const VIEWS_CACHE_TTL_MS = 30_000

async function loadViewsConfig() {
  const now = Date.now()
  if (_teamMembers && _groups && _tagCategories && now - _viewsLoadedAt < VIEWS_CACHE_TTL_MS) return
  try {
    const [membersJson, groupsJson, tagsJson] = await Promise.all([
      getConfig('TEAM_MEMBERS_JSON'),
      getConfig('GROUPS_JSON'),
      getConfig('TAG_CATEGORIES_JSON'),
    ])
    _teamMembers = membersJson ? JSON.parse(membersJson) : DEFAULT_TEAM_MEMBERS
    _groups = groupsJson ? JSON.parse(groupsJson) : DEFAULT_GROUPS
    _tagCategories = tagsJson ? JSON.parse(tagsJson) : DEFAULT_TAG_CATEGORIES
  } catch {
    _teamMembers = DEFAULT_TEAM_MEMBERS
    _groups = DEFAULT_GROUPS
    _tagCategories = DEFAULT_TAG_CATEGORIES
  }
  _viewsLoadedAt = now
}

// ── Sync accessors (use cached values, defaults if not loaded) ────────
// These are safe for client components that import at module level.

export const TEAM_MEMBERS = DEFAULT_TEAM_MEMBERS
export const GROUPS = DEFAULT_GROUPS
export const TAG_CATEGORIES = DEFAULT_TAG_CATEGORIES

export type TeamMemberId = string
export type GroupId = string
export type TagCategoryId = string

// ── Async accessors (load from DB first) ──────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  await loadViewsConfig()
  return _teamMembers || DEFAULT_TEAM_MEMBERS
}

export async function getGroups(): Promise<Group[]> {
  await loadViewsConfig()
  return _groups || DEFAULT_GROUPS
}

export async function getTagCategories(): Promise<TagCategory[]> {
  await loadViewsConfig()
  return _tagCategories || DEFAULT_TAG_CATEGORIES
}

// ── Helper functions ──────────────────────────────────────────────────

export function getMemberById(id: string) {
  const members = _teamMembers || DEFAULT_TEAM_MEMBERS
  return members.find((m) => m.id === id)
}

export function getGroupById(id: string) {
  const groups = _groups || DEFAULT_GROUPS
  return groups.find((g) => g.id === id)
}

export function getTagsByCategory(categoryId: string) {
  const cats = _tagCategories || DEFAULT_TAG_CATEGORIES
  return cats.find((c) => c.id === categoryId)?.tags || []
}

export function getMembersByGroup(groupId: string) {
  const groups = _groups || DEFAULT_GROUPS
  const members = _teamMembers || DEFAULT_TEAM_MEMBERS
  const group = groups.find((g) => g.id === groupId)
  if (!group) return []
  return members.filter((m) => group.members.includes(m.id))
}
