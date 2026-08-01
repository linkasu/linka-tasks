import type { CommentRecord } from '../../domain/models'
import { canEditOwnOrAdmin } from '../../domain/permissions'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'comment:write')
  const id = routeId(event)
  const comment = await useStorage().get<CommentRecord>('comments', id)
  if (!comment || comment.deletedAt)
    notFound('Comment')
  if (!canEditOwnOrAdmin(actor.role, actor.id, comment.authorId))
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  comment.deletedAt = new Date().toISOString()
  comment.updatedAt = comment.deletedAt
  await useStorage().put('comments', comment)
  await recordChange(actor, 'deleted', 'comment', id)
  return { ok: true }
})
