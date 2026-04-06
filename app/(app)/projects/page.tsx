import { getProjects } from '@/actions/projects'
import { ProjectsClient } from './projects-client'
import { requireRole } from '@/lib/auth'

export default async function ProjectsPage() {
  await requireRole('/projects')
  const projects = await getProjects()
  return <ProjectsClient initialProjects={projects} />
}
