import type { Priority } from '#shared/types'

export const priorityPresentation: Record<Priority, { label: string, color: string, icon: string }> = {
  low: { label: 'Низкий', color: 'blue-grey', icon: 'mdi-arrow-down' },
  normal: { label: 'Обычный', color: 'primary', icon: 'mdi-minus' },
  high: { label: 'Высокий', color: 'warning', icon: 'mdi-arrow-up' },
  urgent: { label: 'Срочный', color: 'error', icon: 'mdi-alert' },
}

export const roleLabels = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
} as const

export const userStateLabels = {
  invited: 'Приглашён',
  active: 'Активен',
  suspended: 'Приостановлен',
} as const

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return 'Не задано'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

export function formatMinutes(value: number | null | undefined) {
  if (!value) return '0 мин'
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return [hours ? `${hours} ч` : '', minutes ? `${minutes} мин` : ''].filter(Boolean).join(' ')
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?'
}
