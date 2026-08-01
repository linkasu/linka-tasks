import type { ProjectRecord, StatusRecord } from '../../../domain/models'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'project:read')
  const projectId = routeId(event)
  if (!await useStorage().get<ProjectRecord>('projects', projectId))
    notFound('Project')
  const statuses = (await useStorage().list<StatusRecord>('statuses')).filter(item => item.projectId === projectId)
  return { statuses: statuses.sort((a, b) => a.position - b.position) }
})
