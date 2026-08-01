import { timingSafeEqual } from 'node:crypto'

type ServerEvent = Parameters<typeof getRequestURL>[0]

export function requireInternalJob(event: ServerEvent): void {
  const expected = String(useRuntimeConfig().internalJobSecret || '')
  if (!expected)
    throw createError({ statusCode: 503, statusMessage: 'Internal jobs are not configured' })
  const actual = getHeader(event, 'x-internal-job-secret') || ''
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right))
    throw createError({ statusCode: 401, statusMessage: 'Invalid job secret' })
}
