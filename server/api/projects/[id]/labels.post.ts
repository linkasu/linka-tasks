import { labelCreateSchema } from '#shared/schemas'
import type { LabelRecord, ProjectRecord } from '../../../domain/models'
import { recordChange } from '../../../services/audit'
import { useStorage } from '../../../storage'
import { bodyAs, conflict, notFound, requireUser, routeId } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const projectId = routeId(event)
  if (!await useStorage().get<ProjectRecord>('projects', projectId))
    notFound('Project')
  const input = await bodyAs(event, labelCreateSchema)
  const labels = (await useStorage().list<LabelRecord>('labels')).filter(label => label.projectId === projectId)
  if (labels.some(label => label.name.toLowerCase() === input.name.toLowerCase()))
    conflict('Label name already exists')
  const now = new Date().toISOString()
  const label: LabelRecord = { id: crypto.randomUUID(), projectId, ...input, createdAt: now, updatedAt: now }
  await useStorage().put('labels', label)
  await recordChange(actor, 'created', 'label', label.id, { projectId })
  return { label }
})
