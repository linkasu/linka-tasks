import type { UserRecord } from '../domain/models'
import { publicUser } from '../services/auth'
import { useStorage } from '../storage'
import { requireUser } from '../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'task:read')
  const users = (await useStorage().list<UserRecord>('users'))
    .filter(user => user.state === 'active').map(publicUser).sort((a, b) => a.displayName.localeCompare(b.displayName))
  return { users }
})
