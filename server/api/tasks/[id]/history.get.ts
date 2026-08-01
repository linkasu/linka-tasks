import type { AuditRecord, TaskRecord, UserRecord } from '../../../domain/models'
import { publicUser } from '../../../services/auth'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const taskId = routeId(event)
  if (!await useStorage().get<TaskRecord>('tasks', taskId))
    notFound('Task')
  const [records, users] = await Promise.all([
    useStorage().list<AuditRecord>('audit'),
    useStorage().list<UserRecord>('users'),
  ])
  const userMap = new Map(users.map(user => [user.id, publicUser(user)]))
  const history = records.filter(item => item.entityType === 'task' && item.entityId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(item => ({
      id: item.id, actorId: item.actorId, actor: item.actorId ? userMap.get(item.actorId) ?? null : null,
      action: item.action,
      field: Array.isArray(item.data.fields) ? item.data.fields.join(', ') : null,
      from: typeof item.data.from === 'string' ? item.data.from : null,
      to: typeof item.data.to === 'string' ? item.data.to : null,
      createdAt: item.createdAt,
    }))
  return { history }
})
