import type { Entity } from '../../storage/adapter'
import { tableNames } from '../../storage/adapter'
import { useStorage } from '../../storage'
import { requireUser } from '../../utils/http'

const excluded = new Set(['otp', 'sessions', 'ws_connections'])

export default defineEventHandler(async (event) => {
  requireUser(event, 'admin:export')
  const data: Record<string, Entity[]> = {}
  for (const table of tableNames) {
    if (excluded.has(table))
      continue
    const rows = await useStorage().list<Entity>(table)
    data[table] = rows.map((row) => {
      const clean = { ...row } as Record<string, unknown>
      delete clean.tokenHash
      delete clean.codeHash
      return clean as unknown as Entity
    })
  }
  setHeader(event, 'content-disposition', `attachment; filename="linka-export-${new Date().toISOString().slice(0, 10)}.json"`)
  return { exportedAt: new Date().toISOString(), data }
})
