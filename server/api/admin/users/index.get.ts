import type { UserRecord } from '../../../domain/models'
import { publicUser } from '../../../services/auth'
import { useStorage } from '../../../storage'
import { requireUser } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'admin:users')
  const users = (await useStorage().list<UserRecord>('users')).map(publicUser)
  return { users: users.sort((a, b) => a.username.localeCompare(b.username)) }
})
