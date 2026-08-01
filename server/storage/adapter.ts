export const tableNames = [
  'users', 'invites', 'otp', 'sessions', 'projects', 'statuses', 'tasks', 'labels',
  'task_labels', 'comments', 'time_entries', 'attachments', 'audit', 'outbox',
  'recurrences', 'ws_connections',
] as const

export type TableName = typeof tableNames[number]
export interface Entity { id: string }

export interface StorageAdapter {
  readonly kind: 'memory' | 'ydb'
  migrate(): Promise<void>
  get<T extends Entity>(table: TableName, id: string): Promise<T | null>
  list<T extends Entity>(table: TableName): Promise<T[]>
  put<T extends Entity>(table: TableName, entity: T): Promise<T>
  remove(table: TableName, id: string): Promise<void>
  close(): Promise<void>
}
