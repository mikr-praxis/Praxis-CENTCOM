import { getProject } from '@/actions/projects'
import { ProjectDetailClient } from './project-detail-client'
import { notFound } from 'next/navigation'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    const project = await getProject(id)
    if (!project) notFound()
    return <ProjectDetailClient project={project} />
  } catch {
    notFound()
  }
}
