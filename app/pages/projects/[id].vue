<script setup lang="ts">
import type { Priority, TaskItem } from '#shared/types'
import type { PaginatedResponse, ProjectWorkspace } from '~/types/api'

definePageMeta({ title: 'Проект' })

const route = useRoute()
const { smAndDown } = useDisplay()
const projectId = computed(() => String(route.params.id))
const workspace = ref<ProjectWorkspace | null>(null)
const taskResponse = ref<PaginatedResponse<TaskItem>>({ items: [], total: 0 })
const loadingWorkspace = ref(true)
const loadingTasks = ref(true)
const mutating = ref(false)
const error = ref('')
const taskDialog = ref(false)
const selectedTaskId = ref<string | null>(null)
const view = ref<'kanban' | 'list'>('kanban')
const q = ref('')
const assignee = ref<string | null>(null)
const label = ref<string | null>(null)
const priority = ref<Priority | null>(null)
const due = ref<string | null>(null)
const debouncedTasks = useDebounceFn(loadTasks, 250)
const { fetchUsers } = useUserDirectory()

const tasks = computed(() => taskResponse.value.items)
const statuses = computed(() => workspace.value?.statuses || [])
const members = computed(() => workspace.value?.members || [])
const labels = computed(() => workspace.value?.labels || [])
const canEdit = computed(() => !workspace.value?.project.archivedAt)

watch([q, assignee, label, priority, due], debouncedTasks)
await Promise.all([loadWorkspace(), loadTasks()])

async function loadWorkspace() {
  loadingWorkspace.value = true
  error.value = ''
  try {
    const [projectResponse, labelsResponse, members] = await Promise.all([
      $fetch<Pick<ProjectWorkspace, 'project' | 'statuses'>>(`/api/projects/${projectId.value}`),
      $fetch<{ labels: ProjectWorkspace['labels'] }>(`/api/projects/${projectId.value}/labels`),
      fetchUsers(),
    ])
    workspace.value = { ...projectResponse, labels: labelsResponse.labels, members }
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить проект')
  } finally {
    loadingWorkspace.value = false
  }
}

async function loadTasks() {
  loadingTasks.value = true
  try {
    const response = await $fetch<{ tasks: TaskItem[], total: number }>('/api/tasks', {
      query: {
        projectId: projectId.value,
        q: q.value || undefined,
        assigneeId: assignee.value || undefined,
        labelId: label.value || undefined,
        priority: priority.value || undefined,
        limit: 200,
      },
    })
    taskResponse.value = {
      items: response.tasks.filter(task => matchesDue(task, due.value)),
      total: response.tasks.filter(task => matchesDue(task, due.value)).length,
    }
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить задачи проекта')
  } finally {
    loadingTasks.value = false
  }
}

function matchesDue(task: TaskItem, filter: string | null) {
  if (!filter) return true
  if (filter === 'none') return !task.dueAt
  if (!task.dueAt) return false
  const dueDate = new Date(task.dueAt)
  const now = new Date()
  if (filter === 'overdue') return dueDate < now && !statusFor(task)?.isDone
  if (filter === 'today') return dueDate.toDateString() === now.toDateString()
  if (filter === 'week') return dueDate >= now && dueDate <= new Date(now.getTime() + 7 * 86_400_000)
  return true
}

function openTask(task?: TaskItem) {
  selectedTaskId.value = task?.id || null
  taskDialog.value = true
}

function statusFor(task: TaskItem) {
  return statuses.value.find(status => status.id === task.statusId)
}

function memberFor(task: TaskItem) {
  return members.value.find(member => member.id === task.assigneeId)
}

async function moveTask(payload: { taskId: string, statusId: string, position: number, version: number }) {
  if (!canEdit.value) return
  mutating.value = true
  error.value = ''
  try {
    await $fetch(`/api/tasks/${payload.taskId}`, {
      method: 'PATCH',
      body: { statusId: payload.statusId, position: payload.position, version: payload.version },
    })
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось переместить задачу')
  } finally {
    await loadTasks()
    mutating.value = false
  }
}

async function reorderStatuses(statusIds: string[]) {
  if (!canEdit.value) return
  mutating.value = true
  try {
    await Promise.all(statusIds.map((statusId, position) => $fetch(`/api/statuses/${statusId}`, {
      method: 'PATCH',
      body: { position },
    })))
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось изменить порядок статусов')
  } finally {
    await loadWorkspace()
    mutating.value = false
  }
}

async function onTaskChanged() {
  await loadTasks()
}

async function reloadPage() {
  await Promise.all([loadWorkspace(), loadTasks()])
}
</script>

<template>
  <div class="page-container project-page">
    <VProgressLinear v-if="mutating" indeterminate color="primary" class="mutation-progress" />
    <div v-if="loadingWorkspace" class="mb-6"><VSkeletonLoader type="heading, paragraph" /></div>
    <template v-else-if="workspace">
      <div class="page-heading">
        <div class="d-flex align-start ga-4">
          <VAvatar color="primary" variant="tonal" rounded="lg" size="52">{{ workspace.project.key.slice(0, 2) }}</VAvatar>
          <div>
            <div class="d-flex flex-wrap align-center ga-2 mb-1">
              <span class="text-overline text-primary">{{ workspace.project.key }}</span>
              <VChip v-if="workspace.project.archivedAt" color="warning" size="small" variant="tonal">В архиве</VChip>
            </div>
            <h1 class="font-weight-black mb-2">{{ workspace.project.name }}</h1>
            <p class="text-body-2 text-medium-emphasis">{{ workspace.project.description || 'Описание проекта не добавлено' }}</p>
          </div>
        </div>
        <VBtn v-if="canEdit" color="primary" prepend-icon="mdi-plus" @click="openTask()">Новая задача</VBtn>
      </div>

      <VAlert v-if="workspace.project.archivedAt" type="warning" variant="tonal" class="mb-5">
        Проект находится в архиве. Задачи доступны только для просмотра.
      </VAlert>

      <div class="project-actions mb-4">
        <div class="text-body-2 text-medium-emphasis">{{ taskResponse.total }} задач</div>
        <VBtnToggle v-model="view" mandatory color="primary" density="compact" divided>
          <VBtn value="kanban" prepend-icon="mdi-view-column-outline">Доска</VBtn>
          <VBtn value="list" prepend-icon="mdi-format-list-bulleted">Список</VBtn>
        </VBtnToggle>
      </div>

      <TaskFilters
        v-model:q="q"
        v-model:assignee="assignee"
        v-model:label="label"
        v-model:priority="priority"
        v-model:due="due"
        :members="members"
        :labels="labels"
        compact
      />
    </template>

    <VAlert v-if="error" type="error" variant="tonal" closable class="mb-5" @click:close="error = ''">
      {{ error }}
      <template #append><VBtn variant="text" @click="reloadPage">Повторить</VBtn></template>
    </VAlert>

    <div v-if="loadingTasks" class="d-flex ga-4 overflow-hidden">
      <VSkeletonLoader v-for="index in 4" :key="index" width="300" type="heading, list-item-three-line@3" class="surface-card flex-shrink-0" />
    </div>
    <AppState v-else-if="!tasks.length" title="Задач не найдено" text="Создайте первую задачу или измените фильтры." icon="mdi-clipboard-text-outline" :action-text="canEdit ? 'Создать задачу' : ''" @action="openTask()" />
    <template v-else-if="workspace">
      <KanbanBoard
        v-if="view === 'kanban'"
        :statuses="statuses"
        :tasks="tasks"
        :members="members"
        :can-edit="canEdit"
        @open="openTask"
        @move-task="moveTask"
        @reorder-statuses="reorderStatuses"
      />
      <VCard v-else class="surface-card overflow-hidden" variant="flat">
        <div v-if="smAndDown" class="pa-3 d-grid ga-3">
          <TaskCard
            v-for="task in tasks"
            :key="task.id"
            :task="task"
            :status="statusFor(task)"
            :assignee="memberFor(task)"
            show-status
            @open="openTask"
          />
        </div>
        <VTable v-else hover>
          <thead>
            <tr><th>Задача</th><th>Статус</th><th>Приоритет</th><th>Исполнитель</th><th>Срок</th></tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks" :key="task.id" class="task-row" @click="openTask(task)">
              <td><span class="text-caption text-medium-emphasis mr-2">#{{ task.number }}</span><strong>{{ task.title }}</strong></td>
              <td><VChip v-if="statusFor(task)" :color="statusFor(task)?.color" size="small" variant="tonal">{{ statusFor(task)?.name }}</VChip></td>
              <td><PriorityChip :priority="task.priority" compact /></td>
              <td>{{ memberFor(task)?.displayName || 'Не назначен' }}</td>
              <td>{{ formatDate(task.dueAt, true) }}</td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </template>

    <TaskDialog
      v-if="workspace"
      v-model="taskDialog"
      :task-id="selectedTaskId"
      :project-id="projectId"
      :members="members"
      :statuses="statuses"
      :labels="labels"
      @saved="onTaskChanged"
      @deleted="onTaskChanged"
    />
  </div>
</template>

<style scoped>
.project-page {
  position: relative;
}

.mutation-progress {
  position: fixed;
  z-index: 10;
  top: 64px;
  right: 0;
  left: 0;
}

.project-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-row {
  cursor: pointer;
}

.d-grid {
  display: grid;
}
</style>
