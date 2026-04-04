'use client'

import { useView } from '@/lib/views/context'
import { TEAM_MEMBERS, GROUPS, TAG_CATEGORIES, getTagsByCategory } from '@/lib/views/data'
import { Users, UserCircle, Tag, LayoutGrid, X } from 'lucide-react'
import clsx from 'clsx'

const COLOR_MAP = {
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  green: 'bg-green-500/20 text-green-400 border-green-500/50',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/50',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/50',
}

const DOT_COLOR_MAP = {
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  rose: 'bg-rose-500',
  cyan: 'bg-cyan-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
}

export function ViewSwitcher() {
  const {
    mode,
    setMode,
    selectedUser,
    setSelectedUser,
    selectedGroup,
    setSelectedGroup,
    selectedTagCategory,
    setSelectedTagCategory,
    selectedTag,
    setSelectedTag,
    reset,
  } = useView()

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3 space-y-3">
      {/* Mode tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">View</span>
          <div className="flex items-center gap-1.5">
            {/* All button */}
            <button
              onClick={() => {
                setMode('all')
                setSelectedUser(null)
                setSelectedGroup(null)
                setSelectedTagCategory(null)
                setSelectedTag(null)
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
                mode === 'all'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm font-medium">All</span>
            </button>

            {/* By User button */}
            <button
              onClick={() => setMode('user')}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
                mode === 'user'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
              )}
            >
              <UserCircle className="w-4 h-4" />
              <span className="text-sm font-medium">By User</span>
            </button>

            {/* By Group button */}
            <button
              onClick={() => setMode('group')}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
                mode === 'group'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
              )}
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">By Group</span>
            </button>

            {/* By Tags button */}
            <button
              onClick={() => setMode('tag')}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
                mode === 'tag'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
              )}
            >
              <Tag className="w-4 h-4" />
              <span className="text-sm font-medium">By Tags</span>
            </button>
          </div>
        </div>

        {/* Reset button */}
        {mode !== 'all' && (
          <button
            onClick={reset}
            className="inline-flex items-center justify-center w-6 h-6 rounded-lg border border-slate-700/50 bg-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
            title="Reset filters"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter chips row - User mode */}
      {mode === 'user' && (
        <div className="flex flex-wrap gap-2">
          {TEAM_MEMBERS.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedUser(selectedUser === member.id ? null : (member.id as any))}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium',
                selectedUser === member.id
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
              )}
            >
              <span className="text-base">{member.avatar}</span>
              <span>{member.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter chips row - Group mode */}
      {mode === 'group' && (
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(selectedGroup === group.id ? null : (group.id as any))}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium',
                selectedGroup === group.id
                  ? COLOR_MAP[group.color as keyof typeof COLOR_MAP]
                  : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
              )}
            >
              <div
                className={clsx(
                  'w-2 h-2 rounded-full',
                  selectedGroup === group.id
                    ? DOT_COLOR_MAP[group.color as keyof typeof DOT_COLOR_MAP]
                    : 'bg-slate-600'
                )}
              />
              <span>{group.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter chips row - Tag mode */}
      {mode === 'tag' && (
        <div className="space-y-2">
          {/* Tag category selector */}
          <div className="flex flex-wrap gap-2">
            {TAG_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setSelectedTagCategory(selectedTagCategory === cat.id ? null : (cat.id as any))
                }
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium',
                  selectedTagCategory === cat.id
                    ? COLOR_MAP[cat.color as keyof typeof COLOR_MAP]
                    : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
                )}
              >
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full',
                    selectedTagCategory === cat.id
                      ? DOT_COLOR_MAP[cat.color as keyof typeof DOT_COLOR_MAP]
                      : 'bg-slate-600'
                  )}
                />
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Individual tags within selected category */}
          {selectedTagCategory && (
            <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-slate-700">
              {getTagsByCategory(selectedTagCategory).map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                  className={clsx(
                    'inline-flex items-center px-3 py-1.5 rounded-lg border transition-all text-sm font-medium',
                    selectedTag === tag.id
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
