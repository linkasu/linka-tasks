import { taskLabelsSchema } from '#shared/schemas'
import type { TaskRecord } from '../../../domain/models'
import { recordChange } from '../../../services/audit'
import { hydrateTask, replaceTaskLabels } from '../../../services/tasks'
import { useStorage } from '../../../storage'
import { bodyAs, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const task = await useStorage().get<TaskRecord>('tasks', routeId(event))
  if (!task)
    notFound('Task')
  const { labelIds } = await bodyAs(event, taskLabelsSchema)
  await replaceTaskLabels(task, labelIds)
  task.version += 1
  task.updatedAt = new Date().toISOString()
  await useStorage().put('tasks', task)
  await recordChange(actor, 'labels_updated', 'task', task.id, { labelIds })
  return { task: await hydrateTask(task) }
})
