import { timeEntrySchema } from '#shared/schemas'
import type { TaskRecord, TimeEntryRecord } from '../../../domain/models'
import { recordChange } from '../../../services/audit'
import { useStorage } from '../../../storage'
import { bodyAs, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'time:write')
  const taskId = routeId(event)
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const input = await bodyAs(event, timeEntrySchema)
  const now = new Date().toISOString()
  const entry: TimeEntryRecord = { id: crypto.randomUUID(), taskId, userId: actor.id, ...input, createdAt: now, updatedAt: now }
  await useStorage().put('time_entries', entry)
  await recordChange(actor, 'created', 'time_entry', entry.id, { taskId, minutes: entry.minutes })
  return { entry }
})
