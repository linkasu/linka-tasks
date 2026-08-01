import type { Role } from '#shared/types'

export type Action =
  | 'project:read' | 'project:write'
  | 'task:read' | 'task:write'
  | 'comment:write' | 'time:write'
  | 'admin:users' | 'admin:invites' | 'admin:audit' | 'admin:export'

const grants: Record<Role, ReadonlySet<Action>> = {
  owner: new Set<Action>(['project:read', 'project:write', 'task:read', 'task:write', 'comment:write', 'time:write', 'admin:users', 'admin:invites', 'admin:audit', 'admin:export']),
  admin: new Set<Action>(['project:read', 'project:write', 'task:read', 'task:write', 'comment:write', 'time:write', 'admin:users', 'admin:invites', 'admin:audit', 'admin:export']),
  member: new Set<Action>(['project:read', 'task:read', 'task:write', 'comment:write', 'time:write']),
}

export function can(role: Role, action: Action): boolean {
  return grants[role].has(action)
}

export function canChangeRole(actor: Role, current: Role, next: Role): boolean {
  if (actor !== 'owner')
    return false
  if (current === 'owner' && next !== 'owner')
    return false
  return true
}

export function canEditOwnOrAdmin(role: Role, actorId: string, ownerId: string): boolean {
  return role === 'owner' || role === 'admin' || actorId === ownerId
}
