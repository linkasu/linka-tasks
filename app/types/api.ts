import type {
  AttachmentItem,
  CommentItem,
  InviteItem,
  Priority,
  Project,
  ProjectStatus,
  PublicUser,
  Role,
  TaskItem,
  TaskLabel,
} from '#shared/types'

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  nextCursor?: string | null
}

export interface ProjectSummary extends Project {
  openTasks?: number
  completedTasks?: number
  memberCount?: number
}

export interface ProjectWorkspace {
  project: Project
  statuses: ProjectStatus[]
  labels: TaskLabel[]
  members: PublicUser[]
}

export interface TaskDetails extends TaskItem {
  assignee?: PublicUser | null
  creator?: PublicUser
  status?: ProjectStatus
  recurrence?: RecurrenceRule | null
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number
  nextRunAt: string
  state: 'active' | 'paused'
}

export interface TaskHistoryItem {
  id: string
  actor?: PublicUser | null
  actorId?: string | null
  action: string
  field?: string | null
  from?: string | null
  to?: string | null
  createdAt: string
}

export interface TaskDetailsResponse {
  task: TaskDetails
  comments: CommentItem[]
  attachments: AttachmentItem[]
  history: TaskHistoryItem[]
  members?: PublicUser[]
  statuses?: ProjectStatus[]
  labels?: TaskLabel[]
}

export interface TaskMutation {
  title: string
  description: string
  statusId: string
  priority: Priority
  assigneeId: string | null
  dueAt: string | null
  labelIds: string[]
  estimateMinutes: number | null
  recurrence: RecurrenceRule | null
  version?: number
}

export interface AuditEvent {
  id: string
  actor?: PublicUser | null
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  data?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
  ip?: string | null
  createdAt: string
}

export interface TrashItem {
  id: string
  type: 'task' | 'project' | 'attachment'
  title: string
  deletedBy?: PublicUser | null
  deletedAt: string
  purgeAt?: string | null
}

export interface InviteMutation {
  username: string
  role: Role
}

export interface InviteCreationResponse {
  invite: InviteItem & {
    allowUsernameClaim: boolean
    claimedBy: string | null
    updatedAt: string
  }
  token: string
  startUrl: string | null
}
