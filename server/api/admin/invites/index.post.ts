import { inviteCreateSchema } from '#shared/schemas'
import type { InviteRecord, UserRecord } from '../../../domain/models'
import { recordChange } from '../../../services/audit'
import { useStorage } from '../../../storage'
import { bodyAs, conflict, requireUser } from '../../../utils/http'
import { hashToken, randomToken } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'admin:invites')
  const input = await bodyAs(event, inviteCreateSchema)
  if (input.role === 'owner' && actor.role !== 'owner')
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can invite an owner' })
  const invites = await useStorage().list<InviteRecord>('invites')
  if (invites.some(invite => invite.username === input.username && invite.state === 'pending'))
    conflict('A pending invite already exists')
  const users = await useStorage().list<UserRecord>('users')
  if (users.some(user => user.username === input.username && user.state === 'active'))
    conflict('User is already active')
  const now = new Date().toISOString()
  const token = randomToken(24)
  const invite: InviteRecord = {
    id: crypto.randomUUID(), username: input.username, role: input.role, state: 'pending', tokenHash: hashToken(token), allowUsernameClaim: false,
    claimedBy: null, expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString(),
    createdAt: now, updatedAt: now,
  }
  if (!users.some(user => user.username === input.username)) {
    const user: UserRecord = {
      id: crypto.randomUUID(), username: input.username, displayName: input.username, role: input.role,
      state: 'invited', timezone: 'UTC', telegramChatId: null, createdAt: now, updatedAt: now,
    }
    await useStorage().put('users', user)
  }
  await useStorage().put('invites', invite)
  await recordChange(actor, 'created', 'invite', invite.id, { username: invite.username, role: invite.role })
  const botName = process.env.NUXT_TELEGRAM_BOT_USERNAME?.replace(/^@/, '')
  const { tokenHash: _tokenHash, ...publicInvite } = invite
  return {
    invite: publicInvite, token,
    startUrl: botName ? `https://t.me/${botName}?start=${token}` : null,
  }
})
