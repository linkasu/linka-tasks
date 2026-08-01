import type { AttachmentRecord, TaskRecord } from '../../../../domain/models'
import { presignObject } from '../../../../services/object-storage'
import { useStorage } from '../../../../storage'
import { conflict, notFound, requireUser, routeId } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const taskId = routeId(event)
  const attachmentId = routeId(event, 'attachmentId')
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const attachment = await useStorage().get<AttachmentRecord>('attachments', attachmentId)
  if (!attachment || attachment.taskId !== taskId)
    notFound('Attachment')
  if (attachment.state !== 'ready')
    conflict('Attachment is not ready')
  const config = useRuntimeConfig()
  const storageConfig = {
    bucket: String(config.objectStorageBucket || ''), accessKeyId: String(config.objectStorageAccessKeyId || ''),
    secretAccessKey: String(config.objectStorageSecretAccessKey || ''),
  }
  if (!storageConfig.bucket || !storageConfig.accessKeyId || !storageConfig.secretAccessKey)
    throw createError({ statusCode: 503, statusMessage: 'Object storage is not configured' })
  return sendRedirect(event, presignObject(storageConfig, 'GET', attachment.objectKey, 60), 302)
})
