import type { ZodType } from 'zod'
import type { Action } from '../domain/permissions'
import { can } from '../domain/permissions'

type ServerEvent = Parameters<typeof getRequestURL>[0]

export async function bodyAs<T>(event: ServerEvent, schema: ZodType<T>): Promise<T> {
  const result = schema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, statusMessage: 'Validation failed', data: { issues: result.error.issues } })
  return result.data
}

export function queryAs<T>(event: ServerEvent, schema: ZodType<T>): T {
  const result = schema.safeParse(getQuery(event))
  if (!result.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid query', data: { issues: result.error.issues } })
  return result.data
}

export function routeId(event: ServerEvent, name = 'id'): string {
  const id = getRouterParam(event, name)
  if (!id)
    throw createError({ statusCode: 400, statusMessage: `Missing ${name}` })
  return id
}

export function requireUser(event: ServerEvent, action?: Action) {
  const user = event.context.auth
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (action && !can(user.role, action))
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}

export function notFound(entity: string): never {
  throw createError({ statusCode: 404, statusMessage: `${entity} not found` })
}

export function conflict(message: string): never {
  throw createError({ statusCode: 409, statusMessage: message })
}
