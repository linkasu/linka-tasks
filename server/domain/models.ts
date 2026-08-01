import type { AttachmentItem, AuditItem, CommentItem, InviteItem, Priority, Project, ProjectStatus, PublicUser, RecurrenceItem, Role, TaskLabel, TimeEntryItem, UserState } from '#shared/types'

export interface UserRecord extends PublicUser {
  telegramChatId: string | null
  createdAt: string
  updatedAt: string
}

export interface InviteRecord extends InviteItem {
  tokenHash: string
  allowUsernameClaim: boolean
  claimedBy: string | null
  updatedAt: string
}

export interface OtpRecord {
  id: string
  username: string
  userId: string
  codeHash: string
  state: 'issued' | 'consumed' | 'locked'
  attempts: number
  requesterHash: string
  expiresAt: string
  createdAt: string
}

export interface SessionRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  createdAt: string
  lastSeenAt: string
}

export interface ProjectRecord extends Project {
  createdBy: string
  nextTaskNumber: number
  updatedAt: string
}

export interface StatusRecord extends ProjectStatus {
  createdAt: string
  updatedAt: string
}

export interface TaskRecord {
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
  position: number
  version: number
  recurrenceId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LabelRecord extends TaskLabel {
  createdAt: string
  updatedAt: string
}

export interface TaskLabelRecord {
  id: string
  taskId: string
  labelId: string
  createdAt: string
}

export interface CommentRecord extends CommentItem {
  deletedAt: string | null
}

export type TimeEntryRecord = TimeEntryItem

export interface AttachmentRecord extends AttachmentItem {
  objectKey: string
  etag: string | null
  createdBy: string
}

export type AuditRecord = AuditItem

export interface OutboxRecord {
  id: string
  topic: string
  payload: Record<string, unknown>
  state: 'pending' | 'processing' | 'sent' | 'failed'
  attempts: number
  availableAt: string
  processedAt: string | null
  lastError: string | null
  createdAt: string
}

export type RecurrenceRecord = RecurrenceItem

export interface WsConnectionRecord {
  id: string
  userId: string
  connectedAt: string
  expiresAt: string
}

export type { Role, UserState }
