import { auth } from '@clerk/nextjs/server'
import { MondayClient } from './monday-client'

export const dynamic = 'force-dynamic'

export default async function MondayPage() {
  const { userId } = await auth()
  if (!userId) return null

  return <MondayClient />
}
