import { describe, expect, it } from 'vitest'
import { hashSecret, hashToken, normalizeUsername, randomOtp, verifySecret } from '../../server/utils/security'

describe('authentication helpers', () => {
  it('normalizes Telegram usernames', () => {
    expect(normalizeUsername('  @IBakaidov ')).toBe('ibakaidov')
  })

  it('creates fixed length OTP values', () => {
    expect(randomOtp()).toMatch(/^\d{6}$/)
  })

  it('stores salted verifiable secrets', () => {
    const first = hashSecret('123456')
    const second = hashSecret('123456')
    expect(first).not.toBe(second)
    expect(verifySecret('123456', first)).toBe(true)
    expect(verifySecret('654321', first)).toBe(false)
  })

  it('hashes tokens deterministically without retaining plaintext', () => {
    expect(hashToken('session')).toBe(hashToken('session'))
    expect(hashToken('session')).not.toContain('session')
  })
})
