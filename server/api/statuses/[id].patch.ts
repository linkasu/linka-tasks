import { statusUpdateSchema } from '#shared/schemas'
import type { StatusRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { bodyAs, conflict, notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const id = routeId(event)
  const status = await useStorage().get<StatusRecord>('statuses', id)
  if (!status)
    notFound('Status')
  const input = await bodyAs(event, statusUpdateSchema)
  const siblings = (await useStorage().list<StatusRecord>('statuses')).filter(item => item.projectId === status.projectId && item.id !== id)
  if (input.name && siblings.some(item => item.name.toLowerCase() === input.name!.toLowerCase()))
    conflict('Status name already exists')
  Object.assign(status, input, { updatedAt: new Date().toISOString() })
  await useStorage().put('statuses', status)
  await recordChange(actor, 'updated', 'status', id, { fields: Object.keys(input) })
  return { status }
})
