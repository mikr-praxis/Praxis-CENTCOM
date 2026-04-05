import { auth } from '@clerk/nextjs/server'
import { CalendarClient } from './calendar-client'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const { userId } = await auth()
  if (!userId) return null

  return <CalendarClient />
}
