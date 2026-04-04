'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { TeamMemberId, GroupId, TagCategoryId } from './data'

export type ViewMode = 'all' | 'user' | 'group' | 'tag'

type ViewState = {
  mode: ViewMode
  selectedUser: TeamMemberId | null
  selectedGroup: GroupId | null
  selectedTagCategory: TagCategoryId | null
  selectedTag: string | null
  setMode: (mode: ViewMode) => void
  setSelectedUser: (user: TeamMemberId | null) => void
  setSelectedGroup: (group: GroupId | null) => void
  setSelectedTagCategory: (category: TagCategoryId | null) => void
  setSelectedTag: (tag: string | null) => void
  reset: () => void
}

const ViewContext = createContext<ViewState | undefined>(undefined)

export function ViewProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('all')
  const [selectedUser, setSelectedUser] = useState<TeamMemberId | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<GroupId | null>(null)
  const [selectedTagCategory, setSelectedTagCategory] = useState<TagCategoryId | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const reset = () => {
    setMode('all')
    setSelectedUser(null)
    setSelectedGroup(null)
    setSelectedTagCategory(null)
    setSelectedTag(null)
  }

  return (
    <ViewContext.Provider
      value={{
        mode,
        selectedUser,
        selectedGroup,
        selectedTagCategory,
        selectedTag,
        setMode,
        setSelectedUser,
        setSelectedGroup,
        setSelectedTagCategory,
        setSelectedTag,
        reset,
      }}
    >
      {children}
    </ViewContext.Provider>
  )
}

export function useView() {
  const context = useContext(ViewContext)
  if (!context) throw new Error('useView must be used within a ViewProvider')
  return context
}
