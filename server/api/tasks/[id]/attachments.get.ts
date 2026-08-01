import type { AttachmentRecord, TaskRecord } from '../../../domain/models'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const taskId = routeId(event)
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const attachments = (await useStorage().list<AttachmentRecord>('attachments')).filter(item => item.taskId === taskId)
  return { attachments }
})
