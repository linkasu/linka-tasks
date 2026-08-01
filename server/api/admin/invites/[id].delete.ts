import type { InviteRecord } from '../../../domain/models'
import { inviteTransitions, transition } from '../../../domain/fsm'
import { recordChange } from '../../../services/audit'
import { useStorage } from '../../../storage'
import { notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'admin:invites')
  const invite = await useStorage().get<InviteRecord>('invites', routeId(event))
  if (!invite)
    notFound('Invite')
  invite.state = transition(inviteTransitions, invite.state, 'revoked')
  invite.updatedAt = new Date().toISOString()
  await useStorage().put('invites', invite)
  await recordChange(actor, 'revoked', 'invite', invite.id)
  return { ok: true }
})
