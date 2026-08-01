import type { RuntimeConfig } from 'nuxt/schema'
import { MemoryAdapter } from './memory'
import type { StorageAdapter } from './adapter'
import { YdbAdapter } from './ydb'

let adapter: StorageAdapter | undefined

export function createStorage(config: RuntimeConfig): StorageAdapter {
  const endpoint = String(config.ydbEndpoint || '')
  const database = String(config.ydbDatabase || '')
  if (Boolean(endpoint) !== Boolean(database))
    throw new Error('NUXT_YDB_ENDPOINT and NUXT_YDB_DATABASE must be configured together')
  return endpoint ? new YdbAdapter(endpoint, database) : new MemoryAdapter()
}

export function setStorage(value: StorageAdapter): void {
  adapter = value
}

export function useStorage(): StorageAdapter {
  if (!adapter)
    adapter = createStorage(useRuntimeConfig())
  return adapter
}

export function resetStorage(): void {
  adapter = undefined
}
