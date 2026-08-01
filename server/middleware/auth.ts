import { resolveSessionToken, sessionCookie } from '../services/auth'

const publicPaths = new Set([
  '/api/auth/request-otp', '/api/auth/verify-otp', '/api/telegram/webhook', '/api/health',
  '/api/jobs/recurrences', '/api/jobs/outbox', '/api/realtime',
])

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || publicPaths.has(path))
    return

  const method = event.method.toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const fetchSite = getHeader(event, 'sec-fetch-site')
    const origin = getHeader(event, 'origin')
    const requestUrl = getRequestURL(event)
    const host = (getHeader(event, 'x-forwarded-host') || getHeader(event, 'host') || requestUrl.host).split(',')[0]!.trim()
    const protocol = (getHeader(event, 'x-forwarded-proto') || requestUrl.protocol.replace(':', '')).split(',')[0]!.trim()
    const sameOrigin = !origin || (() => {
      try {
        const source = new URL(origin)
        return source.host === host && source.protocol === `${protocol}:`
      }
      catch { return false }
    })()
    if (fetchSite === 'cross-site' || !sameOrigin)
      throw createError({ statusCode: 403, statusMessage: 'Cross-site request rejected' })
  }

  const user = await resolveSessionToken(getCookie(event, sessionCookie))
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  event.context.auth = user
})
