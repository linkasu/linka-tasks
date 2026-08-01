export interface ParsedRecurrence {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
}

export function parseRecurrence(rule: string): ParsedRecurrence {
  const normalized = rule.replace(/^RRULE:/i, '').toUpperCase()
  const values = Object.fromEntries(normalized.split(';').map(part => part.split('=', 2)))
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(values.FREQ || ''))
    throw new Error('Recurrence FREQ must be DAILY, WEEKLY or MONTHLY')
  const interval = values.INTERVAL ? Number(values.INTERVAL) : 1
  if (!Number.isInteger(interval) || interval < 1 || interval > 365)
    throw new Error('Recurrence INTERVAL must be between 1 and 365')
  return { frequency: values.FREQ as ParsedRecurrence['frequency'], interval }
}

export function nextOccurrence(from: string, rule: string): string {
  const parsed = parseRecurrence(rule)
  const date = new Date(from)
  if (Number.isNaN(date.valueOf()))
    throw new Error('Invalid recurrence date')
  if (parsed.frequency === 'DAILY')
    date.setUTCDate(date.getUTCDate() + parsed.interval)
  else if (parsed.frequency === 'WEEKLY')
    date.setUTCDate(date.getUTCDate() + 7 * parsed.interval)
  else
    date.setUTCMonth(date.getUTCMonth() + parsed.interval)
  return date.toISOString()
}
