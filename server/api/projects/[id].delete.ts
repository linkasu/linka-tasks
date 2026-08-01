import type { ProjectRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const id = routeId(event)
  const project = await useStorage().get<ProjectRecord>('projects', id)
  if (!project)
    notFound('Project')
  project.archivedAt = project.archivedAt ? null : new Date().toISOString()
  project.updatedAt = new Date().toISOString()
  await useStorage().put('projects', project)
  await recordChange(actor, project.archivedAt ? 'archived' : 'restored', 'project', id)
  return { project }
})
