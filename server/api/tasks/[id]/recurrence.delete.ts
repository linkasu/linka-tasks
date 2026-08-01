import type { RecurrenceRecord, TaskRecord } from '../../../domain/models'
import { recordChange } from '../../../services/audit'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const task = await useStorage().get<TaskRecord>('tasks', routeId(event))
  if (!task)
    notFound('Task')
  if (!task.recurrenceId)
    notFound('Recurrence')
  const recurrence = await useStorage().get<RecurrenceRecord>('recurrences', task.recurrenceId)
  if (!recurrence)
    notFound('Recurrence')
  await useStorage().remove('recurrences', recurrence.id)
  task.recurrenceId = null
  task.version += 1
  task.updatedAt = new Date().toISOString()
  await useStorage().put('tasks', task)
  await recordChange(actor, 'deleted', 'recurrence', recurrence.id, { taskId: task.id })
  return { ok: true }
})
