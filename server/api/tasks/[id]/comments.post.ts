import { commentSchema } from '#shared/schemas'
import type { CommentRecord, TaskRecord } from '../../../domain/models'
import { recordChange } from '../../../services/audit'
import { useStorage } from '../../../storage'
import { bodyAs, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'comment:write')
  const taskId = routeId(event)
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const input = await bodyAs(event, commentSchema)
  const now = new Date().toISOString()
  const comment: CommentRecord = {
    id: crypto.randomUUID(), taskId, authorId: actor.id, body: input.body,
    createdAt: now, updatedAt: now, deletedAt: null,
  }
  await useStorage().put('comments', comment)
  await recordChange(actor, 'created', 'comment', comment.id, { taskId })
  return { comment }
})
