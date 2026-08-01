import { createRequire } from 'node:module'
import type * as YdbSdk from 'ydb-sdk'
import { migrationStatements } from './migrations'
import type { Entity, StorageAdapter, TableName } from './adapter'

interface YdbValue {
  textValue?: string | Uint8Array
  bytesValue?: Uint8Array
}

export class YdbAdapter implements StorageAdapter {
  readonly kind = 'ydb' as const
  private readonly driver: InstanceType<typeof YdbSdk.Driver>
  private readonly typedValues: typeof YdbSdk.TypedValues
  private readonly base: string

  constructor(endpoint: string, database: string) {
    if (!endpoint || !database)
      throw new Error('Both YDB endpoint and database are required')
    this.base = database.replace(/\/$/, '')
    const require = createRequire(import.meta.url)
    const sdk = require('ydb-sdk') as typeof YdbSdk
    this.typedValues = sdk.TypedValues
    this.driver = new sdk.Driver({ endpoint, database, authService: sdk.getCredentialsFromEnv() })
  }

  async migrate(): Promise<void> {
    if (!await this.driver.ready(10_000))
      throw new Error('YDB driver is not ready')
    await this.driver.queryClient.do({
      idempotent: true,
      fn: async (session) => {
        for (const statement of migrationStatements(this.base)) {
          const result = await session.execute({ text: statement, idempotent: true })
          for await (const resultSet of result.resultSets) {
            for await (const _row of resultSet.rows) {
              // DDL has no rows, but consuming the stream releases the query session.
            }
          }
          await result.opFinished
        }
      },
    })
  }

  async get<T extends Entity>(table: TableName, id: string): Promise<T | null> {
    const rows = await this.queryPayloads(table, 'WHERE id = $id', { $id: this.typedValues.utf8(id) })
    return (rows[0] as T | undefined) ?? null
  }

  async list<T extends Entity>(table: TableName): Promise<T[]> {
    return await this.queryPayloads(table) as T[]
  }

  async put<T extends Entity>(table: TableName, entity: T): Promise<T> {
    const query = `
      DECLARE $id AS Utf8;
      DECLARE $payload AS JsonDocument;
      DECLARE $updated_at AS Timestamp;
      UPSERT INTO \`${this.base}/${table}\` (id, payload, updated_at)
      VALUES ($id, $payload, $updated_at);
    `
    await this.driver.tableClient.withSessionRetry(session => session.executeQuery(query, {
      $id: this.typedValues.utf8(entity.id),
      $payload: this.typedValues.jsonDocument(JSON.stringify(entity)),
      $updated_at: this.typedValues.timestamp(new Date()),
    }))
    return entity
  }

  async remove(table: TableName, id: string): Promise<void> {
    const query = `DECLARE $id AS Utf8; DELETE FROM \`${this.base}/${table}\` WHERE id = $id;`
    await this.driver.tableClient.withSessionRetry(session => session.executeQuery(query, { $id: this.typedValues.utf8(id) }))
  }

  async close(): Promise<void> {
    await this.driver.destroy()
  }

  private async queryPayloads(table: TableName, suffix = '', params: Record<string, ReturnType<typeof YdbSdk.TypedValues.utf8>> = {}): Promise<Entity[]> {
    const declaration = params.$id ? 'DECLARE $id AS Utf8;' : ''
    const result = await this.driver.tableClient.withSessionRetry(session => session.executeQuery(
      `${declaration} SELECT payload FROM \`${this.base}/${table}\` ${suffix};`,
      params,
    ))
    return (result.resultSets?.[0]?.rows ?? []).map((row) => {
      const value = row.items?.[0] as YdbValue | undefined
      const encoded = value?.textValue ?? value?.bytesValue
      if (encoded === undefined)
        throw new Error(`YDB returned an invalid ${table} payload`)
      return JSON.parse(typeof encoded === 'string' ? encoded : Buffer.from(encoded).toString('utf8')) as Entity
    })
  }
}
