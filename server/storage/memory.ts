import { tableNames, type Entity, type StorageAdapter, type TableName } from './adapter'

export class MemoryAdapter implements StorageAdapter {
  readonly kind = 'memory' as const
  private readonly tables = new Map<TableName, Map<string, Entity>>()

  constructor() {
    for (const name of tableNames)
      this.tables.set(name, new Map())
  }

  async migrate(): Promise<void> {}

  async get<T extends Entity>(table: TableName, id: string): Promise<T | null> {
    return (structuredClone(this.tables.get(table)?.get(id)) as T | undefined) ?? null
  }

  async list<T extends Entity>(table: TableName): Promise<T[]> {
    return [...(this.tables.get(table)?.values() ?? [])].map(value => structuredClone(value) as T)
  }

  async put<T extends Entity>(table: TableName, entity: T): Promise<T> {
    this.tables.get(table)!.set(entity.id, structuredClone(entity))
    return structuredClone(entity)
  }

  async remove(table: TableName, id: string): Promise<void> {
    this.tables.get(table)?.delete(id)
  }

  async close(): Promise<void> {}
}
