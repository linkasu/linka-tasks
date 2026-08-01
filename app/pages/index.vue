<script setup lang="ts">
import type { Priority, ProjectStatus, PublicUser, TaskItem, TaskLabel } from '#shared/types'
import type { PaginatedResponse } from '~/types/api'

definePageMeta({ title: 'Мои задачи' })

interface MyTasksResponse extends PaginatedResponse<TaskItem> {
  statuses?: ProjectStatus[]
  members?: PublicUser[]
  labels?: TaskLabel[]
}

const route = useRoute()
const router = useRouter()
const q = ref('')
const assignee = ref<string | null>(null)
const label = ref<string | null>(null)
const priority = ref<Priority | null>(null)
const due = ref<string | null>(null)
const error = ref('')
const loading = ref(true)
const response = ref<MyTasksResponse>({ items: [], total: 0 })
const debouncedLoad = useDebounceFn(loadTasks, 250)
const { user } = useAuth()
const { fetchUsers } = useUserDirectory()

const tasks = computed(() => response.value.items)
const members = computed(() => response.value.members || [])
const statuses = computed(() => response.value.statuses || [])
const labels = computed(() => response.value.labels || [])
const completion = computed(() => {
  if (!tasks.value.length) return 0
  const done = tasks.value.filter(task => statuses.value.find(status => status.id === task.statusId)?.isDone).length
  return Math.round(done / tasks.value.length * 100)
})

watch([q, assignee, label, priority, due], debouncedLoad)

onMounted(() => {
  if (route.query.focus === 'q') requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[aria-label="Поиск"]')?.focus())
})

await loadMetadata()
await loadTasks()

async function loadMetadata() {
  try {
    const [{ projects }, users] = await Promise.all([
      $fetch<{ projects: Array<{ id: string }> }>('/api/projects'),
      fetchUsers(),
    ])
    const workspaces = await Promise.all(projects.map(async (project) => {
      const [projectResponse, labelsResponse] = await Promise.all([
        $fetch<{ statuses: ProjectStatus[] }>(`/api/projects/${project.id}`),
        $fetch<{ labels: TaskLabel[] }>(`/api/projects/${project.id}/labels`),
      ])
      return { statuses: projectResponse.statuses, labels: labelsResponse.labels }
    }))
    response.value.members = users
    response.value.statuses = workspaces.flatMap(item => item.statuses)
    response.value.labels = workspaces.flatMap(item => item.labels)
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить справочники задач')
  }
}

async function loadTasks() {
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ tasks: TaskItem[], total: number }>('/api/tasks', {
      query: {
        q: q.value || undefined,
        assigneeId: assignee.value || user.value?.id || undefined,
        labelId: label.value || undefined,
        priority: priority.value || undefined,
        limit: 200,
      },
    })
    const filtered = result.tasks.filter(task => matchesDue(task, due.value))
    response.value = { ...response.value, items: filtered, total: filtered.length }
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить задачи')
  } finally {
    loading.value = false
  }
}

function matchesDue(task: TaskItem, filter: string | null) {
  if (!filter) return true
  if (filter === 'none') return !task.dueAt
  if (!task.dueAt) return false
  const date = new Date(task.dueAt)
  const now = new Date()
  if (filter === 'overdue') return date < now && !statusFor(task)?.isDone
  if (filter === 'today') return date.toDateString() === now.toDateString()
  if (filter === 'week') return date >= now && date <= new Date(now.getTime() + 7 * 86_400_000)
  return true
}

function statusFor(task: TaskItem) {
  return statuses.value.find(status => status.id === task.statusId)
}

function assigneeFor(task: TaskItem) {
  return members.value.find(member => member.id === task.assigneeId)
}
</script>

<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <p class="text-overline text-primary mb-1">Личное пространство</p>
        <h1 class="font-weight-black mb-2">Мои задачи</h1>
        <p class="text-body-1 text-medium-emphasis">Всё, что требует вашего внимания, в одном списке.</p>
      </div>
      <VBtn color="primary" prepend-icon="mdi-plus" to="/projects">Создать в проекте</VBtn>
    </div>

    <div class="dashboard-summary mb-5">
      <VCard class="summary-main surface-card" variant="flat">
        <VCardText class="pa-5">
          <div class="text-caption text-medium-emphasis mb-1">Текущая выборка</div>
          <div class="d-flex align-end ga-3">
            <strong class="text-h3">{{ response.total }}</strong>
            <span class="text-body-2 text-medium-emphasis pb-1">задач</span>
          </div>
        </VCardText>
      </VCard>
      <VCard class="surface-card" variant="flat">
        <VCardText class="pa-5">
          <div class="d-flex justify-space-between text-caption mb-3">
            <span class="text-medium-emphasis">Завершено</span>
            <strong>{{ completion }}%</strong>
          </div>
          <VProgressLinear :model-value="completion" color="success" rounded height="8" />
        </VCardText>
      </VCard>
    </div>

    <TaskFilters
      v-model:q="q"
      v-model:assignee="assignee"
      v-model:label="label"
      v-model:priority="priority"
      v-model:due="due"
      :members="members"
      :labels="labels"
    />

    <VAlert v-if="error" type="error" variant="tonal" closable class="mb-5" @click:close="error = ''">
      {{ error }}
      <template #append><VBtn variant="text" @click="loadTasks">Повторить</VBtn></template>
    </VAlert>

    <div v-if="loading" class="tasks-grid">
      <VSkeletonLoader v-for="index in 6" :key="index" type="article" class="surface-card" />
    </div>
    <AppState
      v-else-if="!tasks.length"
      title="Задач не найдено"
      text="Измените фильтры или создайте задачу в одном из проектов."
      icon="mdi-check-all"
      action-text="Открыть проекты"
      @action="router.push('/projects')"
    />
    <div v-else class="tasks-grid">
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :status="statusFor(task)"
        :assignee="assigneeFor(task)"
        show-status
        @open="router.push(`/tasks/${task.id}`)"
      />
    </div>
  </div>
</template>

<style scoped>
.dashboard-summary {
  display: grid;
  grid-template-columns: minmax(230px, 0.65fr) minmax(260px, 1fr);
  gap: 16px;
}

.summary-main {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.12), rgba(var(--v-theme-primary), 0.03));
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

@media (max-width: 600px) {
  .dashboard-summary {
    grid-template-columns: 1fr;
  }
}
</style>
