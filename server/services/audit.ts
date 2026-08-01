import type { AuditRecord, OutboxRecord, UserRecord } from '../domain/models'
import { useStorage } from '../storage'
import { broadcast } from './realtime'

export async function recordChange(
  actor: Pick<UserRecord, 'id'> | null,
  action: string,
  entityType: string,
  entityId: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const storage = useStorage()
  const now = new Date().toISOString()
  const audit: AuditRecord = {
    id: crypto.randomUUID(), actorId: actor?.id ?? null, action, entityType, entityId, data, createdAt: now,
  }
  const outbox: OutboxRecord = {
    id: crypto.randomUUID(), topic: `${entityType}.${action}`, payload: { entityType, entityId, ...data },
    state: 'pending', attempts: 0, availableAt: now, processedAt: null, lastError: null, createdAt: now,
  }
  await storage.put('audit', audit)
  await storage.put('outbox', outbox)
  await broadcast({ type: outbox.topic, entityId, data })
}
