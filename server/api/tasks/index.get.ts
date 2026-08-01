import { taskListQuerySchema } from '#shared/schemas'
import type { TaskLabelRecord, TaskRecord } from '../../domain/models'
import { hydrateTasks } from '../../services/tasks'
import { useStorage } from '../../storage'
import { queryAs, requireUser } from '../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const query = queryAs(event, taskListQuerySchema)
  const links = query.labelId
    ? (await useStorage().list<TaskLabelRecord>('task_labels')).filter(link => link.labelId === query.labelId)
    : []
  const labelledTaskIds = new Set(links.map(link => link.taskId))
  const needle = query.q?.toLocaleLowerCase()
  let tasks = (await useStorage().list<TaskRecord>('tasks')).filter(task =>
    (query.trash === 'true' ? task.deletedAt !== null : task.deletedAt === null)
    && (!query.projectId || task.projectId === query.projectId)
    && (!query.statusId || task.statusId === query.statusId)
    && (!query.assigneeId || task.assigneeId === query.assigneeId)
    && (!query.priority || task.priority === query.priority)
    && (!query.labelId || labelledTaskIds.has(task.id))
    && (!needle || task.title.toLocaleLowerCase().includes(needle) || task.description.toLocaleLowerCase().includes(needle)),
  )
  tasks = tasks.sort((a, b) => a.position - b.position || b.updatedAt.localeCompare(a.updatedAt))
  const total = tasks.length
  tasks = tasks.slice(query.offset, query.offset + query.limit)
  return { tasks: await hydrateTasks(tasks), total, limit: query.limit, offset: query.offset }
})
