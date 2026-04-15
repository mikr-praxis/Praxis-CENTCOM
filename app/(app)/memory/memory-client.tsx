'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Brain, User, Folder, Bookmark, MessageSquareQuote } from 'lucide-react'
import { clsx } from 'clsx'
import type { MemoryEntry, MemoryType } from '@/lib/memory/loader'

const typeConfig: Record<MemoryType, {
  label: string
  variant: 'blue' | 'amber' | 'green' | 'orange'
  icon: typeof User
  description: string
}> = {
  user: {
    label: 'User',
    variant: 'blue',
    icon: User,
    description: 'Owner profile and preferences',
  },
  project: {
    label: 'Project',
    variant: 'amber',
    icon: Folder,
    description: 'Live project state, architecture, and status',
  },
  reference: {
    label: 'Reference',
    variant: 'green',
    icon: Bookmark,
    description: 'Pointers to external systems and docs',
  },
  feedback: {
    label: 'Feedback',
    variant: 'orange',
    icon: MessageSquareQuote,
    description: 'Guidance learned from prior sessions',
  },
}

const filters: Array<'all' | MemoryType> = ['all', 'user', 'project', 'reference', 'feedback']

export function MemoryClient({ entries }: { entries: MemoryEntry[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>('all')

  const visible = filter === 'all' ? entries : entries.filter((e) => e.type === filter)

  const counts: Record<MemoryType, number> = { user: 0, project: 0, reference: 0, feedback: 0 }
  for (const e of entries) counts[e.type] = (counts[e.type] ?? 0) + 1

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-slate-100">Memory</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Persistent context Claude Code uses across sessions
          </p>
        </div>
        <Badge variant="gray">{entries.length} entries</Badge>
      </div>

      <Card className="bg-amber-500/5 border-amber-500/20">
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-slate-200 font-medium">How this works</p>
            <p className="text-xs text-slate-400 mt-1">
              These markdown files live in your <code className="text-amber-400">~/.claude/projects/</code> directory and get auto-loaded
              into every Claude Code session, so the assistant starts with full context about you, CENTCOM,
              active integrations, and past guidance — without re-explaining each time.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(typeConfig) as MemoryType[]).map((type) => {
          const cfg = typeConfig[type]
          const Icon = cfg.icon
          return (
            <Card key={type} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {cfg.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{counts[type] ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{cfg.description}</p>
            </Card>
          )
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              filter === f
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
          >
            {f === 'all' ? `All (${entries.length})` : `${typeConfig[f].label} (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((entry) => {
          const cfg = typeConfig[entry.type]
          const Icon = cfg.icon
          return (
            <Card key={entry.slug}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Icon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-100">{entry.name}</h3>
                    {entry.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{entry.description}</p>
                    )}
                  </div>
                </div>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
              <pre className="whitespace-pre-wrap break-words text-sm text-slate-300 font-sans bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
{entry.body}
              </pre>
              <p className="text-[11px] text-slate-600 mt-2 font-mono">{entry.slug}.md</p>
            </Card>
          )
        })}

        {visible.length === 0 && (
          <Card className="text-center py-12 text-slate-500">
            No memory entries of this type yet.
          </Card>
        )}
      </div>
    </div>
  )
}
