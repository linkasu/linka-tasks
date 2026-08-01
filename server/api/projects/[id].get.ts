import type { ProjectRecord, StatusRecord } from '../../domain/models'
import { useStorage } from '../../storage'
import { notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'project:read')
  const id = routeId(event)
  const project = await useStorage().get<ProjectRecord>('projects', id)
  if (!project)
    notFound('Project')
  const statuses = (await useStorage().list<StatusRecord>('statuses'))
    .filter(status => status.projectId === id).sort((a, b) => a.position - b.position)
  return { project, statuses }
})
