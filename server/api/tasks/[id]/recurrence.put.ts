import { recurrenceSchema } from '#shared/schemas'
import type { RecurrenceRecord, TaskRecord } from '../../../domain/models'
import { recurrenceTransitions, transition } from '../../../domain/fsm'
import { recordChange } from '../../../services/audit'
import { parseRecurrence } from '../../../services/recurrence'
import { useStorage } from '../../../storage'
import { bodyAs, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'task:write')
  const task = await useStorage().get<TaskRecord>('tasks', routeId(event))
  if (!task)
    notFound('Task')
  const input = await bodyAs(event, recurrenceSchema)
  try { parseRecurrence(input.rule) }
  catch (error) { throw createError({ statusCode: 400, statusMessage: (error as Error).message }) }
  const now = new Date().toISOString()
  let recurrence = task.recurrenceId ? await useStorage().get<RecurrenceRecord>('recurrences', task.recurrenceId) : null
  if (recurrence) {
    if (recurrence.state !== input.state)
      transition(recurrenceTransitions, recurrence.state, input.state)
    Object.assign(recurrence, input, { updatedAt: now })
  }
  else {
    recurrence = { id: crypto.randomUUID(), taskId: task.id, ...input, createdAt: now, updatedAt: now }
    task.recurrenceId = recurrence.id
    task.version += 1
    task.updatedAt = now
    await useStorage().put('tasks', task)
  }
  await useStorage().put('recurrences', recurrence)
  await recordChange(actor, 'upserted', 'recurrence', recurrence.id, { taskId: task.id })
  return { recurrence }
})
