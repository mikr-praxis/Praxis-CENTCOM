'use client'

import { useView } from '@/lib/views/context'
import { getMemberById, getGroupById, TAG_CATEGORIES } from '@/lib/views/data'
import { X } from 'lucide-react'
import clsx from 'clsx'

export function ViewBadge() {
  const {
    mode,
    selectedUser,
    selectedGroup,
    selectedTagCategory,
    selectedTag,
    reset,
  } = useView()

  if (mode === 'all') return null

  let label = ''
  let type = ''

  if (mode === 'user' && selectedUser) {
    const member = getMemberById(selectedUser)
    if (member) {
      label = `${member.avatar} ${member.name}`
      type = 'User'
    }
  } else if (mode === 'group' && selectedGroup) {
    const group = getGroupById(selectedGroup)
    if (group) {
      label = group.name
      type = 'Group'
    }
  } else if (mode === 'tag' && selectedTag) {
    const category = TAG_CATEGORIES.find((c) => c.id === selectedTagCategory)
    const tag = category?.tags.find((t) => t.id === selectedTag)
    if (tag) {
      label = tag.label
      type = 'Tag'
    }
  }

  if (!label) return null

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-400">
      <span className="text-sm font-medium">
        <span className="text-amber-600 font-semibold">[{type}:</span>
        <span className="ml-1">{label}</span>
        <span className="text-amber-600 font-semibold">]</span>
      </span>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center w-4 h-4 ml-1 rounded hover:bg-amber-500/20 transition-all"
        title="Clear filter"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
