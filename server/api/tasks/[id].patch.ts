import { taskUpdateSchema } from '#shared/schemas'
import type { StatusRecord, TaskRecord, UserRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { hydrateTask } from '../../services/tasks'
import { useStorage } from '../../storage'
import { bodyAs, conflict, notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const id = routeId(event)
  const task = await useStorage().get<TaskRecord>('tasks', id)
  if (!task)
    notFound('Task')
  if (task.deletedAt)
    conflict('Restore the task before editing it')
  const input = await bodyAs(event, taskUpdateSchema)
  if (input.version !== task.version)
    conflict('Task was updated by another client')
  if (input.statusId) {
    const status = await useStorage().get<StatusRecord>('statuses', input.statusId)
    if (!status || status.projectId !== task.projectId)
      throw createError({ statusCode: 400, statusMessage: 'Status does not belong to the project' })
  }
  if (input.assigneeId) {
    const user = await useStorage().get<UserRecord>('users', input.assigneeId)
    if (!user || user.state !== 'active')
      throw createError({ statusCode: 400, statusMessage: 'Invalid assignee' })
  }
  const { version: _version, ...changes } = input
  Object.assign(task, changes, { version: task.version + 1, updatedAt: new Date().toISOString() })
  await useStorage().put('tasks', task)
  await recordChange(actor, 'updated', 'task', id, { fields: Object.keys(changes), version: task.version })
  return { task: await hydrateTask(task) }
})
