import { taskCreateSchema } from '#shared/schemas'
import type { ProjectRecord, StatusRecord, TaskRecord, UserRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { hydrateTask, replaceTaskLabels } from '../../services/tasks'
import { useStorage } from '../../storage'
import { bodyAs, notFound, requireUser } from '../../utils/http'
import { serialized } from '../../utils/lock'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const input = await bodyAs(event, taskCreateSchema)
  const task = await serialized(async () => {
    const project = await useStorage().get<ProjectRecord>('projects', input.projectId)
    if (!project || project.archivedAt)
      notFound('Project')
    const status = await useStorage().get<StatusRecord>('statuses', input.statusId)
    if (!status || status.projectId !== project.id)
      throw createError({ statusCode: 400, statusMessage: 'Status does not belong to the project' })
    if (input.assigneeId) {
      const assignee = await useStorage().get<UserRecord>('users', input.assigneeId)
      if (!assignee || assignee.state !== 'active')
        throw createError({ statusCode: 400, statusMessage: 'Invalid assignee' })
    }
    const now = new Date().toISOString()
    const created: TaskRecord = {
      id: crypto.randomUUID(), number: project.nextTaskNumber++, projectId: project.id, statusId: input.statusId,
      title: input.title, description: input.description, priority: input.priority, assigneeId: input.assigneeId,
      creatorId: actor.id, dueAt: input.dueAt, estimateMinutes: input.estimateMinutes, position: input.position,
      version: 1, recurrenceId: null, deletedAt: null, createdAt: now, updatedAt: now,
    }
    project.updatedAt = now
    await useStorage().put('projects', project)
    await useStorage().put('tasks', created)
    await replaceTaskLabels(created, input.labelIds)
    return created
  })
  await recordChange(actor, 'created', 'task', task.id, { projectId: task.projectId, number: task.number })
  return { task: await hydrateTask(task) }
})
