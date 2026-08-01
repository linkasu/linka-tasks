import type { TaskRecord } from '../../domain/models'
import { taskTransitions, transition } from '../../domain/fsm'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { conflict, notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const id = routeId(event)
  const task = await useStorage().get<TaskRecord>('tasks', id)
  if (!task)
    notFound('Task')
  if (task.deletedAt)
    conflict('Task is already in trash')
  transition(taskTransitions, 'active', 'trashed')
  task.deletedAt = new Date().toISOString()
  task.updatedAt = task.deletedAt
  task.version += 1
  await useStorage().put('tasks', task)
  await recordChange(actor, 'trashed', 'task', id)
  return { task }
})
