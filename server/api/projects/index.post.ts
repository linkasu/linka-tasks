import { projectCreateSchema } from '#shared/schemas'
import type { ProjectRecord, StatusRecord } from '../../domain/models'
import { recordChange } from '../../services/audit'
import { useStorage } from '../../storage'
import { bodyAs, conflict, requireUser } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireUser(event, 'project:write')
  const input = await bodyAs(event, projectCreateSchema)
  if ((await useStorage().list<ProjectRecord>('projects')).some(project => project.key === input.key))
    conflict('Project key already exists')
  const now = new Date().toISOString()
  const project: ProjectRecord = {
    id: crypto.randomUUID(), ...input, archivedAt: null, createdAt: now, updatedAt: now,
    createdBy: actor.id, nextTaskNumber: 1,
  }
  const initial: StatusRecord[] = [
    { id: crypto.randomUUID(), projectId: project.id, name: 'К выполнению', color: '#607D8B', position: 0, isDone: false, createdAt: now, updatedAt: now },
    { id: crypto.randomUUID(), projectId: project.id, name: 'Готово', color: '#2E7D32', position: 1, isDone: true, createdAt: now, updatedAt: now },
  ]
  await useStorage().put('projects', project)
  await Promise.all(initial.map(status => useStorage().put('statuses', status)))
  await recordChange(actor, 'created', 'project', project.id, { key: project.key })
  return { project, statuses: initial }
})
