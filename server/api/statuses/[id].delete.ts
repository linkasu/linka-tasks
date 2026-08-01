import type { StatusRecord, TaskRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { conflict, notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const id = routeId(event)
  const status = await useStorage().get<StatusRecord>('statuses', id)
  if (!status)
    notFound('Status')
  if ((await useStorage().list<TaskRecord>('tasks')).some(task => task.statusId === id))
    conflict('Status is used by tasks')
  await useStorage().remove('statuses', id)
  await recordChange(actor, 'deleted', 'status', id, { projectId: status.projectId })
  return { ok: true }
})
