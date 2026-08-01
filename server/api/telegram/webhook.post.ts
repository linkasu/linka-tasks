import { z } from 'zod'
import type { InviteRecord, UserRecord } from '../../domain/models'
import { inviteTransitions, transition, userTransitions } from '../../domain/fsm'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { hashToken, normalizeUsername } from '../../utils/security'

const updateSchema = z.object({
  message: z.object({
    text: z.string().optional(),
    chat: z.object({ id: z.union([z.number(), z.string()]) }),
    from: z.object({ username: z.string().optional() }).optional(),
  }).optional(),
}).passthrough()

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const expected = String(config.telegramWebhookSecret || config.telegramProxySecret || '')
  if (!expected)
    throw createError({ statusCode: 503, statusMessage: 'Telegram webhook is not configured' })
  if (getHeader(event, 'x-telegram-bot-api-secret-token') !== expected)
    throw createError({ statusCode: 401, statusMessage: 'Invalid webhook secret' })
  const parsed = updateSchema.safeParse(await readBody(event))
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid Telegram update' })
  const message = parsed.data.message
  if (!message?.text?.startsWith('/start') || !message.from?.username)
    return { ok: true }

  const username = normalizeUsername(message.from.username)
  const suppliedToken = message.text.split(/\s+/, 2)[1]
  const invites = await useStorage().list<InviteRecord>('invites')
  const invite = invites.find(item => item.state === 'pending' && item.username === username
    && (suppliedToken ? item.tokenHash === hashToken(suppliedToken) : item.allowUsernameClaim))
  if (!invite || Date.parse(invite.expiresAt) <= Date.now())
    return { ok: true }

  const users = await useStorage().list<UserRecord>('users')
  let user = users.find(item => item.username === username)
  const now = new Date().toISOString()
  if (!user) {
    user = {
      id: crypto.randomUUID(), username, displayName: username, role: invite.role, state: 'active', timezone: 'UTC',
      telegramChatId: String(message.chat.id), createdAt: now, updatedAt: now,
    }
  }
  else {
    user.telegramChatId = String(message.chat.id)
    user.state = transition(userTransitions, user.state, 'active')
    user.updatedAt = now
  }
  invite.state = transition(inviteTransitions, invite.state, 'claimed')
  invite.claimedBy = user.id
  invite.updatedAt = now
  await useStorage().put('users', user)
  await useStorage().put('invites', invite)
  await recordChange(user, 'claimed', 'invite', invite.id)
  return { ok: true }
})
