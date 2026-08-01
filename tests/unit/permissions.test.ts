import { describe, expect, it } from 'vitest'
import { can, canChangeRole, canEditOwnOrAdmin } from '../../server/domain/permissions'

describe('permissions', () => {
  it('keeps administration unavailable to members', () => {
    expect(can('member', 'task:write')).toBe(true)
    expect(can('member', 'project:write')).toBe(false)
    expect(can('member', 'admin:users')).toBe(false)
  })

  it('only lets the owner change roles without demoting the owner', () => {
    expect(canChangeRole('admin', 'member', 'admin')).toBe(false)
    expect(canChangeRole('owner', 'member', 'admin')).toBe(true)
    expect(canChangeRole('owner', 'owner', 'admin')).toBe(false)
  })

  it('allows own resources and administrator overrides', () => {
    expect(canEditOwnOrAdmin('member', 'u1', 'u1')).toBe(true)
    expect(canEditOwnOrAdmin('member', 'u1', 'u2')).toBe(false)
    expect(canEditOwnOrAdmin('admin', 'u1', 'u2')).toBe(true)
  })
})
