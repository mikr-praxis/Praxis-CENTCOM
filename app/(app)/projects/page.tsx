import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { ProjectsClient } from './projects-client'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const supabase = createServerClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return <ProjectsClient initialProjects={projects || []} />
}
