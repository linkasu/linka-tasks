import { statusCreateSchema } from '#shared/schemas'
import type { ProjectRecord, StatusRecord } from '../../../domain/models'
import { recordChange } from '../../../services/audit'
import { useStorage } from '../../../storage'
import { bodyAs, conflict, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const projectId = routeId(event)
  if (!await useStorage().get<ProjectRecord>('projects', projectId))
    notFound('Project')
  const input = await bodyAs(event, statusCreateSchema)
  const statuses = (await useStorage().list<StatusRecord>('statuses')).filter(item => item.projectId === projectId)
  if (statuses.some(item => item.name.toLowerCase() === input.name.toLowerCase()))
    conflict('Status name already exists')
  const now = new Date().toISOString()
  const status: StatusRecord = {
    id: crypto.randomUUID(), projectId, ...input,
    position: input.position ?? statuses.length, createdAt: now, updatedAt: now,
  }
  await useStorage().put('statuses', status)
  await recordChange(actor, 'created', 'status', status.id, { projectId })
  return { status }
})
