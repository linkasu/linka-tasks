import type { ProjectRecord, RecurrenceRecord, TaskLabelRecord, TaskRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { nextOccurrence } from '../../services/recurrence'
import { useStorage } from '../../storage'
import { requireInternalJob } from '../../utils/internal-auth'
import { serialized } from '../../utils/lock'

export default defineEventHandler(async (event) => {
  requireInternalJob(event)
  const due = (await useStorage().list<RecurrenceRecord>('recurrences'))
    .filter(item => item.state === 'active' && Date.parse(item.nextRunAt) <= Date.now())
  let created = 0
  for (const recurrence of due) {
    await serialized(async () => {
      const template = await useStorage().get<TaskRecord>('tasks', recurrence.taskId)
      if (!template || template.deletedAt) {
        recurrence.state = 'paused'
        recurrence.updatedAt = new Date().toISOString()
        await useStorage().put('recurrences', recurrence)
        return
      }
      const project = await useStorage().get<ProjectRecord>('projects', template.projectId)
      if (!project || project.archivedAt)
        return
      const now = new Date().toISOString()
      const task: TaskRecord = {
        ...template, id: crypto.randomUUID(), number: project.nextTaskNumber++, creatorId: template.creatorId,
        recurrenceId: recurrence.id, deletedAt: null, version: 1, createdAt: now, updatedAt: now,
      }
      const links = (await useStorage().list<TaskLabelRecord>('task_labels')).filter(link => link.taskId === template.id)
      await useStorage().put('projects', { ...project, updatedAt: now })
      await useStorage().put('tasks', task)
      await Promise.all(links.map(link => useStorage().put<TaskLabelRecord>('task_labels', {
        id: `${task.id}:${link.labelId}`, taskId: task.id, labelId: link.labelId, createdAt: now,
      })))
      recurrence.nextRunAt = nextOccurrence(recurrence.nextRunAt, recurrence.rule)
      recurrence.updatedAt = now
      await useStorage().put('recurrences', recurrence)
      await recordChange(null, 'generated', 'task', task.id, { recurrenceId: recurrence.id })
      created += 1
    })
  }
  return { processed: due.length, created }
})
