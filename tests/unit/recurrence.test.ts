import { describe, expect, it } from 'vitest'
import { nextOccurrence, parseRecurrence } from '../../server/services/recurrence'

describe('recurrence helpers', () => {
  it('parses bounded RRULE subsets', () => {
    expect(parseRecurrence('RRULE:FREQ=WEEKLY;INTERVAL=2')).toEqual({ frequency: 'WEEKLY', interval: 2 })
    expect(() => parseRecurrence('FREQ=SECONDLY')).toThrow()
  })

  it('calculates the next UTC occurrence', () => {
    expect(nextOccurrence('2026-08-01T10:00:00.000Z', 'FREQ=DAILY;INTERVAL=3')).toBe('2026-08-04T10:00:00.000Z')
  })
})
