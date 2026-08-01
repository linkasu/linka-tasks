import type { SessionRecord, UserRecord } from '../domain/models'
import { useStorage } from '../storage'
import { hashToken, randomToken } from '../utils/security'

export const sessionCookie = 'linka_session'
type ServerEvent = Parameters<typeof getRequestURL>[0]

export async function createSession(event: ServerEvent, user: UserRecord): Promise<void> {
  const token = randomToken()
  const now = new Date()
  const session: SessionRecord = {
    id: crypto.randomUUID(), userId: user.id, tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(), lastSeenAt: now.toISOString(),
  }
  await useStorage().put('sessions', session)
  setCookie(event, sessionCookie, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })
}

export async function resolveSessionToken(token: string | undefined): Promise<UserRecord | null> {
  if (!token)
    return null
  const tokenHash = hashToken(token)
  const session = (await useStorage().list<SessionRecord>('sessions')).find(item => item.tokenHash === tokenHash)
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    if (session)
      await useStorage().remove('sessions', session.id)
    return null
  }
  const user = await useStorage().get<UserRecord>('users', session.userId)
  if (!user || user.state !== 'active')
    return null
  session.lastSeenAt = new Date().toISOString()
  await useStorage().put('sessions', session)
  return user
}

export async function destroySession(event: ServerEvent): Promise<void> {
  const token = getCookie(event, sessionCookie)
  if (token) {
    const tokenHash = hashToken(token)
    const session = (await useStorage().list<SessionRecord>('sessions')).find(item => item.tokenHash === tokenHash)
    if (session)
      await useStorage().remove('sessions', session.id)
  }
  deleteCookie(event, sessionCookie, { path: '/' })
}

export function publicUser(user: UserRecord) {
  const { id, username, displayName, role, state, timezone } = user
  return { id, username, displayName, role, state, timezone }
}
