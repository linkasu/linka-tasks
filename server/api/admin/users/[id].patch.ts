import { userUpdateSchema } from '#shared/schemas'
import type { UserRecord } from '../../../domain/models'
import { transition, userTransitions } from '../../../domain/fsm'
import { canChangeRole } from '../../../domain/permissions'
import { recordChange } from '../../../services/audit'
import { publicUser } from '../../../services/auth'
import { useStorage } from '../../../storage'
import { bodyAs, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'admin:users')
  const id = routeId(event)
  const user = await useStorage().get<UserRecord>('users', id)
  if (!user)
    notFound('User')
  const input = await bodyAs(event, userUpdateSchema)
  if (input.role && input.role !== user.role && !canChangeRole(actor.role, user.role, input.role))
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can change roles' })
  if (user.role === 'owner' && input.state && input.state !== 'active')
    throw createError({ statusCode: 400, statusMessage: 'The owner cannot be suspended' })
  if (input.state && input.state !== user.state) {
    try { input.state = transition(userTransitions, user.state, input.state) }
    catch { throw createError({ statusCode: 400, statusMessage: `Invalid user state transition: ${user.state} -> ${input.state}` }) }
  }
  Object.assign(user, input, { updatedAt: new Date().toISOString() })
  await useStorage().put('users', user)
  if (input.state === 'suspended') {
    const sessions = await useStorage().list<{ id: string, userId: string }>('sessions')
    await Promise.all(sessions.filter(session => session.userId === user.id).map(session => useStorage().remove('sessions', session.id)))
  }
  await recordChange(actor, 'updated', 'user', id, { fields: Object.keys(input) })
  return { user: publicUser(user) }
})
