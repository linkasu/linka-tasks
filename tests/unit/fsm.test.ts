import { describe, expect, it } from 'vitest'
import { inviteTransitions, otpTransitions, taskTransitions, transition, userTransitions } from '../../server/domain/fsm'

describe('transition', () => {
  it('allows declared and idempotent transitions', () => {
    expect(transition(inviteTransitions, 'pending', 'claimed')).toBe('claimed')
    expect(transition(taskTransitions, 'active', 'trashed')).toBe('trashed')
    expect(transition(taskTransitions, 'active', 'active')).toBe('active')
    expect(transition(userTransitions, 'invited', 'active')).toBe('active')
  })

  it('rejects terminal and reverse transitions', () => {
    expect(() => transition(inviteTransitions, 'claimed', 'pending')).toThrow('Invalid transition')
    expect(() => transition(otpTransitions, 'consumed', 'issued')).toThrow('Invalid transition')
    expect(() => transition(userTransitions, 'active', 'invited')).toThrow('Invalid transition')
  })
})
