import type { ProjectRecord } from '../../domain/models'
import { useStorage } from '../../storage'
import { requireUser } from '../../utils/http'

export default defineEventHandler(async (event) => {
  requireUser(event, 'project:read')
  const projects = await useStorage().list<ProjectRecord>('projects')
  return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)) }
})
