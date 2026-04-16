import { ProjectsClient } from './projects-client'
import { requireRole } from '@/lib/auth'

export default async function ProjectsPage() {
  await requireRole('/projects')
  return <ProjectsClient />
}
