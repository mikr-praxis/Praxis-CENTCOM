'use client'

import { createContext, useContext } from 'react'
import type { Role } from '@/lib/roles'

type RoleContextValue = {
  role: Role
  email: string
}

const RoleContext = createContext<RoleContextValue>({ role: 'cs', email: '' })

export function RoleProvider({
  role,
  email,
  children,
}: {
  role: Role
  email: string
  children: React.ReactNode
}) {
  return (
    <RoleContext.Provider value={{ role, email }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
}
