import { attachmentFinalizeSchema } from '#shared/schemas'
import type { AttachmentRecord } from '../../../domain/models'
import { attachmentTransitions, transition } from '../../../domain/fsm'
import { recordChange } from '../../../services/audit'
import { presignObject } from '../../../services/object-storage'
import { useStorage } from '../../../storage'
import { bodyAs, conflict, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const attachment = await useStorage().get<AttachmentRecord>('attachments', routeId(event))
  if (!attachment)
    notFound('Attachment')
  if (attachment.state !== 'pending')
    conflict('Attachment is already finalized')
  const input = await bodyAs(event, attachmentFinalizeSchema)
  const config = useRuntimeConfig()
  const storageConfig = {
    bucket: String(config.objectStorageBucket || ''), accessKeyId: String(config.objectStorageAccessKeyId || ''),
    secretAccessKey: String(config.objectStorageSecretAccessKey || ''),
  }
  if (!storageConfig.bucket || !storageConfig.accessKeyId || !storageConfig.secretAccessKey)
    throw createError({ statusCode: 503, statusMessage: 'Object storage is not configured' })
  const response = await fetch(presignObject(storageConfig, 'HEAD', attachment.objectKey, 60), { method: 'HEAD' })
  const actualEtag = response.headers.get('etag')?.replaceAll('"', '')
  if (!response.ok || !actualEtag || actualEtag !== input.etag.replaceAll('"', ''))
    throw createError({ statusCode: 409, statusMessage: 'Uploaded object could not be verified' })
  const actualSize = Number(response.headers.get('content-length'))
  if (actualSize !== attachment.size)
    throw createError({ statusCode: 409, statusMessage: 'Uploaded object size does not match' })
  attachment.state = transition(attachmentTransitions, attachment.state, 'ready')
  attachment.etag = actualEtag
  await useStorage().put('attachments', attachment)
  await recordChange(actor, 'finalized', 'attachment', attachment.id, { taskId: attachment.taskId })
  return { attachment }
})
