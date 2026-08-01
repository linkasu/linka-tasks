import type { LabelRecord, ProjectRecord } from '../../../domain/models'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'project:read')
  const projectId = routeId(event)
  if (!await useStorage().get<ProjectRecord>('projects', projectId))
    notFound('Project')
  const labels = (await useStorage().list<LabelRecord>('labels')).filter(label => label.projectId === projectId)
  return { labels: labels.sort((a, b) => a.name.localeCompare(b.name)) }
})
