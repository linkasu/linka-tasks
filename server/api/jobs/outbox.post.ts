import type { OutboxRecord, TaskRecord, UserRecord } from '../../domain/models'
import { outboxTransitions, transition } from '../../domain/fsm'
import { sendTelegramMessage } from '../../services/telegram'
import { useStorage } from '../../storage'
import { requireInternalJob } from '../../utils/internal-auth'

export default defineEventHandler(async (event) => {
  requireInternalJob(event)
  const token = String(useRuntimeConfig().telegramBotToken || '')
  const items = (await useStorage().list<OutboxRecord>('outbox'))
    .filter(item => item.state === 'pending' && Date.parse(item.availableAt) <= Date.now()).slice(0, 100)
  let sent = 0
  let failed = 0
  for (const item of items) {
    item.state = transition(outboxTransitions, item.state, 'processing')
    item.attempts += 1
    await useStorage().put('outbox', item)
    try {
      if (token && item.topic.startsWith('task.')) {
        const task = await useStorage().get<TaskRecord>('tasks', String(item.payload.entityId || ''))
        const user = task?.assigneeId ? await useStorage().get<UserRecord>('users', task.assigneeId) : null
        if (task && user?.telegramChatId)
          await sendTelegramMessage(token, user.telegramChatId, `Обновлена задача #${task.number}: ${task.title}`)
      }
      item.state = transition(outboxTransitions, item.state, 'sent')
      item.processedAt = new Date().toISOString()
      item.lastError = null
      sent += 1
    }
    catch (error) {
      item.state = transition(outboxTransitions, item.state, item.attempts >= 5 ? 'failed' : 'pending')
      item.availableAt = new Date(Date.now() + 2 ** item.attempts * 30_000).toISOString()
      item.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Unknown delivery error'
      failed += 1
    }
    await useStorage().put('outbox', item)
  }
  return { processed: items.length, sent, failed }
})
