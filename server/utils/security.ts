import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function randomOtp(): string {
  return String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0')
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

export function hashSecret(value: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(value, salt, 32)
  return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`
}

export function verifySecret(value: string, encoded: string): boolean {
  const [algorithm, saltValue, digestValue] = encoded.split(':')
  if (algorithm !== 'scrypt' || !saltValue || !digestValue)
    return false
  const expected = Buffer.from(digestValue, 'base64url')
  const actual = scryptSync(value, Buffer.from(saltValue, 'base64url'), expected.length)
  return timingSafeEqual(actual, expected)
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}
