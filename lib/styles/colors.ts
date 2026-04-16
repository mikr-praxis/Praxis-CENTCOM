// Centralized color maps used across components.
// Import these instead of defining local Record<string, string> maps.

import type { ProjectStage } from '@/lib/supabase/types'

// ── Priority colors (tasks, projects) ──────────────────────────────────
export const priorityVariant: Record<string, 'red' | 'amber' | 'green'> = {
  high: 'red',
  medium: 'amber',
  low: 'green',
}

// ── Project pipeline stages ────────────────────────────────────────────
export const stageColors: Record<ProjectStage, string> = {
  lead: 'bg-slate-500',
  discovery: 'bg-purple-500',
  proposal: 'bg-blue-500',
  onboarded: 'bg-cyan-500',
  building: 'bg-amber-500',
  qa: 'bg-orange-500',
  deployed: 'bg-emerald-500',
}

export const stageBadgeVariant: Record<ProjectStage, 'gray' | 'blue' | 'amber' | 'green' | 'orange' | 'default'> = {
  lead: 'gray',
  discovery: 'default',
  proposal: 'blue',
  onboarded: 'blue',
  building: 'amber',
  qa: 'orange',
  deployed: 'green',
}

// ── Task status colors ─────────────────────────────────────────────────
export const statusColors: Record<string, string> = {
  todo: 'text-slate-400',
  inprogress: 'text-blue-400',
  review: 'text-amber-400',
  done: 'text-emerald-400',
}
