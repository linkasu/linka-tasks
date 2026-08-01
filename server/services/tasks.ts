import type { TaskItem } from '#shared/types'
import type { LabelRecord, TaskLabelRecord, TaskRecord, TimeEntryRecord } from '../domain/models'
import { useStorage } from '../storage'

export async function hydrateTask(task: TaskRecord): Promise<TaskItem> {
  const storage = useStorage()
  const [links, labels, entries] = await Promise.all([
    storage.list<TaskLabelRecord>('task_labels'),
    storage.list<LabelRecord>('labels'),
    storage.list<TimeEntryRecord>('time_entries'),
  ])
  const labelIds = new Set(links.filter(link => link.taskId === task.id).map(link => link.labelId))
  return {
    ...task,
    labels: labels.filter(label => labelIds.has(label.id)),
    spentMinutes: entries.filter(entry => entry.taskId === task.id).reduce((sum, entry) => sum + entry.minutes, 0),
  }
}

export async function hydrateTasks(tasks: TaskRecord[]): Promise<TaskItem[]> {
  const storage = useStorage()
  const [links, labels, entries] = await Promise.all([
    storage.list<TaskLabelRecord>('task_labels'),
    storage.list<LabelRecord>('labels'),
    storage.list<TimeEntryRecord>('time_entries'),
  ])
  const labelMap = new Map(labels.map(label => [label.id, label]))
  const linksByTask = new Map<string, string[]>()
  const spentByTask = new Map<string, number>()
  for (const link of links)
    linksByTask.set(link.taskId, [...(linksByTask.get(link.taskId) ?? []), link.labelId])
  for (const entry of entries)
    spentByTask.set(entry.taskId, (spentByTask.get(entry.taskId) ?? 0) + entry.minutes)
  return tasks.map(task => ({
    ...task,
    labels: (linksByTask.get(task.id) ?? []).flatMap(id => labelMap.get(id) ?? []),
    spentMinutes: spentByTask.get(task.id) ?? 0,
  }))
}

export async function replaceTaskLabels(task: TaskRecord, labelIds: string[]): Promise<void> {
  const storage = useStorage()
  const uniqueIds = [...new Set(labelIds)]
  const labels = await storage.list<LabelRecord>('labels')
  if (uniqueIds.some(id => !labels.some(label => label.id === id && label.projectId === task.projectId)))
    throw createError({ statusCode: 400, statusMessage: 'A label does not belong to the task project' })
  const current = (await storage.list<TaskLabelRecord>('task_labels')).filter(link => link.taskId === task.id)
  await Promise.all(current.map(link => storage.remove('task_labels', link.id)))
  const now = new Date().toISOString()
  await Promise.all(uniqueIds.map(labelId => storage.put<TaskLabelRecord>('task_labels', {
    id: `${task.id}:${labelId}`, taskId: task.id, labelId, createdAt: now,
  })))
}
