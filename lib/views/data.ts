// Team members
export const TEAM_MEMBERS = [
  { id: 'nadeem', name: 'Nadeem', role: 'Co-Founder', group: 'exec', avatar: '🟠' },
  { id: 'derek', name: 'Derek', role: 'Co-Founder', group: 'exec', avatar: '🔵' },
  { id: 'kevin', name: 'Kevin', role: 'Co-Founder', group: 'exec', avatar: '🟢' },
  { id: 'mike', name: 'Mike', role: 'Data & Ops', group: 'data-analyst', avatar: '🟣' },
] as const

export type TeamMemberId = typeof TEAM_MEMBERS[number]['id']

// Groups
export const GROUPS = [
  { id: 'exec', name: 'Exec', description: 'Executive leadership', color: 'amber', members: ['nadeem', 'derek', 'kevin'] },
  { id: 'account-manager', name: 'Account Manager', description: 'Client relationship management', color: 'blue', members: ['derek'] },
  { id: 'marketing-manager', name: 'Marketing Manager', description: 'Paid media & funnel strategy', color: 'green', members: ['kevin'] },
  { id: 'data-analyst', name: 'Data Analyst', description: 'Data, ops & automation', color: 'purple', members: ['mike'] },
  { id: 'event-coordinator', name: 'Event Coordinator', description: 'Event planning & execution', color: 'rose', members: ['nadeem', 'derek'] },
] as const

export type GroupId = typeof GROUPS[number]['id']

// Tag categories
export const TAG_CATEGORIES = [
  {
    id: 'client',
    name: 'Client Tags',
    color: 'cyan',
    tags: [
      { id: 'breathe-for-change', label: 'Breathe for Change' },
      { id: 'mantalks', label: 'ManTalks' },
      { id: 'john-wineland', label: 'John Wineland' },
      { id: 'soma-plus-iq', label: 'Soma Plus IQ' },
      { id: 'krista-mishore', label: 'Krista Mishore' },
    ],
  },
  {
    id: 'state',
    name: 'State Tags',
    color: 'emerald',
    tags: [
      { id: 'active', label: 'Active' },
      { id: 'onboarding', label: 'Onboarding' },
      { id: 'paused', label: 'Paused' },
      { id: 'completed', label: 'Completed' },
    ],
  },
  {
    id: 'event',
    name: 'Event Tags',
    color: 'violet',
    tags: [
      { id: 'virtual', label: 'Virtual' },
      { id: 'in-person', label: 'In-Person' },
      { id: 'workshop', label: 'Workshop' },
      { id: 'masterclass', label: 'Masterclass' },
    ],
  },
  {
    id: 'importance',
    name: 'Importance Tags',
    color: 'rose',
    tags: [
      { id: 'critical', label: 'Critical' },
      { id: 'high', label: 'High' },
      { id: 'medium', label: 'Medium' },
      { id: 'low', label: 'Low' },
    ],
  },
] as const

export type TagCategoryId = typeof TAG_CATEGORIES[number]['id']

// Helper functions
export function getMemberById(id: string) {
  return TEAM_MEMBERS.find((m) => m.id === id)
}

export function getGroupById(id: string) {
  return GROUPS.find((g) => g.id === id)
}

export function getTagsByCategory(categoryId: string) {
  return TAG_CATEGORIES.find((c) => c.id === categoryId)?.tags || []
}

export function getMembersByGroup(groupId: string) {
  const group = GROUPS.find((g) => g.id === groupId)
  if (!group) return []
  return TEAM_MEMBERS.filter((m) => (group.members as readonly string[]).includes(m.id))
}
