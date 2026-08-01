import { describe, expect, it } from 'vitest'
import { MemoryAdapter } from '../../server/storage/memory'

describe('MemoryAdapter', () => {
  it('stores isolated entity copies and removes them', async () => {
    const storage = new MemoryAdapter()
    const source = { id: 'one', value: { enabled: true } }
    await storage.put('projects', source)
    source.value.enabled = false

    const stored = await storage.get<typeof source>('projects', source.id)
    expect(stored).toEqual({ id: 'one', value: { enabled: true } })
    stored!.value.enabled = false
    expect((await storage.get<typeof source>('projects', source.id))!.value.enabled).toBe(true)

    await storage.remove('projects', source.id)
    expect(await storage.get('projects', source.id)).toBeNull()
  })
})
