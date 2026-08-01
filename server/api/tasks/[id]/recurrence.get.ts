import type { RecurrenceRecord, TaskRecord } from '../../../domain/models'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const task = await useStorage().get<TaskRecord>('tasks', routeId(event))
  if (!task)
    notFound('Task')
  const recurrence = task.recurrenceId ? await useStorage().get<RecurrenceRecord>('recurrences', task.recurrenceId) : null
  return { recurrence }
})
