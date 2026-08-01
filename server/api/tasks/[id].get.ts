import type { TaskRecord } from '../../domain/models'
import { hydrateTask } from '../../services/tasks'
import { useStorage } from '../../storage'
import { notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const task = await useStorage().get<TaskRecord>('tasks', routeId(event))
  if (!task)
    notFound('Task')
  return { task: await hydrateTask(task) }
})
