type Graph<S extends string> = Readonly<Record<S, readonly S[]>>

export function transition<S extends string>(graph: Graph<S>, from: S, to: S): S {
  if (from === to)
    return to
  if (!graph[from].includes(to))
    throw new Error(`Invalid transition: ${from} -> ${to}`)
  return to
}

export const inviteTransitions = {
  pending: ['claimed', 'revoked'],
  claimed: [],
  revoked: [],
} as const

export const otpTransitions = {
  issued: ['consumed', 'locked'],
  consumed: [],
  locked: [],
} as const

export const attachmentTransitions = {
  pending: ['ready'],
  ready: [],
} as const

export const recurrenceTransitions = {
  active: ['paused'],
  paused: ['active'],
} as const

export const userTransitions = {
  invited: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
} as const

export const outboxTransitions = {
  pending: ['processing'],
  processing: ['sent', 'failed', 'pending'],
  sent: [],
  failed: ['pending'],
} as const

export type TaskLifecycle = 'active' | 'trashed'
export const taskTransitions = {
  active: ['trashed'],
  trashed: ['active'],
} as const
