import { attachmentPresignSchema } from '#shared/schemas'
import type { AttachmentRecord, TaskRecord } from '../../../../domain/models'
import { recordChange } from '../../../../services/audit'
import { presignObject } from '../../../../services/object-storage'
import { useStorage } from '../../../../storage'
import { bodyAs, notFound, requireUser, routeId } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const taskId = routeId(event)
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const config = useRuntimeConfig()
  const storageConfig = {
    bucket: String(config.objectStorageBucket || ''), accessKeyId: String(config.objectStorageAccessKeyId || ''),
    secretAccessKey: String(config.objectStorageSecretAccessKey || ''),
  }
  if (!storageConfig.bucket || !storageConfig.accessKeyId || !storageConfig.secretAccessKey)
    throw createError({ statusCode: 503, statusMessage: 'Object storage is not configured' })
  const input = await bodyAs(event, attachmentPresignSchema)
  const now = new Date().toISOString()
  const attachment: AttachmentRecord = {
    id: crypto.randomUUID(), taskId, ...input, state: 'pending', objectKey: `tasks/${taskId}/${crypto.randomUUID()}-${input.fileName}`,
    etag: null, createdBy: actor.id, createdAt: now,
  }
  await useStorage().put('attachments', attachment)
  await recordChange(actor, 'presigned', 'attachment', attachment.id, { taskId })
  return { attachment, uploadUrl: presignObject(storageConfig, 'PUT', attachment.objectKey), expiresIn: 900 }
})
