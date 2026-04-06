import { getProject } from '@/actions/projects'
import { ProjectDetailClient } from './project-detail-client'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole('/projects')
  const { id } = await params

  try {
    const project = await getProject(id)
    if (!project) notFound()
    return <ProjectDetailClient project={project} />
  } catch {
    notFound()
  }
}
