import type { TaskRecord, TimeEntryRecord } from '../../../domain/models'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const taskId = routeId(event)
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const entries = (await useStorage().list<TimeEntryRecord>('time_entries'))
    .filter(entry => entry.taskId === taskId).sort((a, b) => b.entryDate.localeCompare(a.entryDate))
  return { entries }
})
