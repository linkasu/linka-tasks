import { z } from 'zod'
import type { AuditRecord } from '../../domain/models'
import { useStorage } from '../../storage'
import { queryAs, requireUser } from '../../utils/http'

const schema = z.object({
  actorId: z.string().uuid().optional(), entityType: z.string().max(100).optional(),
  action: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).strict()

export default defineEventHandler(async (event) => {
  requireUser(event, 'admin:audit')
  const query = queryAs(event, schema)
  let audit = (await useStorage().list<AuditRecord>('audit')).filter(item =>
    (!query.actorId || item.actorId === query.actorId)
    && (!query.entityType || item.entityType === query.entityType)
    && (!query.action || item.action === query.action),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const total = audit.length
  audit = audit.slice(query.offset, query.offset + query.limit)
  return { audit, total, limit: query.limit, offset: query.offset }
})
