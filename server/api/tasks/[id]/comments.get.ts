import type { CommentRecord, TaskRecord } from '../../../domain/models'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const taskId = routeId(event)
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const comments = (await useStorage().list<CommentRecord>('comments'))
    .filter(comment => comment.taskId === taskId && !comment.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { comments }
})
