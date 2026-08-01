import type { LabelRecord, TaskLabelRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { notFound, requireUser, routeId } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const id = routeId(event)
  const label = await useStorage().get<LabelRecord>('labels', id)
  if (!label)
    notFound('Label')
  const links = (await useStorage().list<TaskLabelRecord>('task_labels')).filter(link => link.labelId === id)
  await Promise.all(links.map(link => useStorage().remove('task_labels', link.id)))
  await useStorage().remove('labels', id)
  await recordChange(actor, 'deleted', 'label', id)
  return { ok: true }
})
