import type { InviteRecord } from '../../../domain/models'
import { useStorage } from '../../../storage'
import { requireUser } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'admin:invites')
  const invites = (await useStorage().list<InviteRecord>('invites')).map(({ tokenHash: _tokenHash, ...invite }) => invite)
  return { invites: invites.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
})
