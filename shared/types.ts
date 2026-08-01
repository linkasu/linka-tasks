export type Role = 'owner' | 'admin' | 'member'
export type UserState = 'invited' | 'active' | 'suspended'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export interface PublicUser {
  id: string
  username: string
  displayName: string
  role: Role
  state: UserState
  timezone: string
}

export interface ProjectStatus {
  id: string
  projectId: string
  name: string
  color: string
  position: number
  isDone: boolean
}

export interface Project {
  id: string
  key: string
  name: string
  description: string
  archivedAt: string | null
  createdAt: string
}

export interface TaskLabel {
  id: string
  projectId: string
  name: string
  color: string
}

export interface TaskItem {
  id: string
  number: number
  projectId: string
  statusId: string
  title: string
  description: string
  priority: Priority
  assigneeId: string | null
  creatorId: string
  dueAt: string | null
  estimateMinutes: number | null
  spentMinutes: number
  position: number
  version: number
  labels: TaskLabel[]
  recurrenceId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CommentItem {
  id: string
  taskId: string
  authorId: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface AttachmentItem {
  id: string
  taskId: string
  fileName: string
  contentType: string
  size: number
  state: 'pending' | 'ready'
  createdAt: string
}

export interface TimeEntryItem {
  id: string
  taskId: string
  userId: string
  minutes: number
  note: string
  entryDate: string
  createdAt: string
  updatedAt: string
}

export interface RecurrenceItem {
  id: string
  taskId: string
  rule: string
  timezone: string
  nextRunAt: string
  state: 'active' | 'paused'
  createdAt: string
  updatedAt: string
}

export interface InviteItem {
  id: string
  username: string
  role: Role
  state: 'pending' | 'claimed' | 'revoked'
  expiresAt: string
  createdAt: string
}

export interface AuditItem {
  id: string
  actorId: string | null
  action: string
  entityType: string
  entityId: string
  data: Record<string, unknown>
  createdAt: string
}
