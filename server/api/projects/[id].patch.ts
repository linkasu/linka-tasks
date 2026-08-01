import { projectUpdateSchema } from '#shared/schemas'
import type { ProjectRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { bodyAs, conflict, notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const id = routeId(event)
  const project = await useStorage().get<ProjectRecord>('projects', id)
  if (!project)
    notFound('Project')
  const input = await bodyAs(event, projectUpdateSchema)
  if (input.key && (await useStorage().list<ProjectRecord>('projects')).some(item => item.id !== id && item.key === input.key))
    conflict('Project key already exists')
  Object.assign(project, input, { updatedAt: new Date().toISOString() })
  await useStorage().put('projects', project)
  await recordChange(actor, 'updated', 'project', id, { fields: Object.keys(input) })
  return { project }
})
