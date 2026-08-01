import { labelUpdateSchema } from '#shared/schemas'
import type { LabelRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { bodyAs, conflict, notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const id = routeId(event)
  const label = await useStorage().get<LabelRecord>('labels', id)
  if (!label)
    notFound('Label')
  const input = await bodyAs(event, labelUpdateSchema)
  const siblings = (await useStorage().list<LabelRecord>('labels')).filter(item => item.projectId === label.projectId && item.id !== id)
  if (input.name && siblings.some(item => item.name.toLowerCase() === input.name!.toLowerCase()))
    conflict('Label name already exists')
  Object.assign(label, input, { updatedAt: new Date().toISOString() })
  await useStorage().put('labels', label)
  await recordChange(actor, 'updated', 'label', id)
  return { label }
})
