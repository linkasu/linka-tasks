import { timeEntryUpdateSchema } from '#shared/schemas'
import type { TimeEntryRecord } from '../../domain/models'
import { canEditOwnOrAdmin } from '../../domain/permissions'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { bodyAs, notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'time:write')
  const id = routeId(event)
  const entry = await useStorage().get<TimeEntryRecord>('time_entries', id)
  if (!entry)
    notFound('Time entry')
  if (!canEditOwnOrAdmin(actor.role, actor.id, entry.userId))
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  Object.assign(entry, await bodyAs(event, timeEntryUpdateSchema), { updatedAt: new Date().toISOString() })
  await useStorage().put('time_entries', entry)
  await recordChange(actor, 'updated', 'time_entry', id)
  return { entry }
})
