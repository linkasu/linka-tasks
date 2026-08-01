import type { InviteRecord, UserRecord } from '../domain/models'
import type { StorageAdapter } from '../storage/adapter'
import { hashToken, randomToken } from '../utils/security'

export async function seedOwner(storage: StorageAdapter): Promise<void> {
  const existing = (await storage.list<UserRecord>('users')).find(user => user.username === 'ibakaidov')
  if (existing)
    return

  const now = new Date().toISOString()
  const user: UserRecord = {
    id: crypto.randomUUID(), username: 'ibakaidov', displayName: 'ibakaidov', role: 'owner',
    state: 'invited', timezone: 'UTC', telegramChatId: null, createdAt: now, updatedAt: now,
  }
  const invite: InviteRecord = {
    id: crypto.randomUUID(), username: user.username, role: 'owner', state: 'pending',
    tokenHash: hashToken(randomToken()), allowUsernameClaim: true, claimedBy: null,
    expiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(), createdAt: now, updatedAt: now,
  }
  await storage.put('users', user)
  await storage.put('invites', invite)
}
