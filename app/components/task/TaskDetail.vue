<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify'
import { marked } from 'marked'
import type { AttachmentItem, CommentItem, Priority, ProjectStatus, PublicUser, RecurrenceItem, TaskItem, TaskLabel } from '#shared/types'
import type { RecurrenceRule, TaskDetailsResponse, TaskHistoryItem, TaskMutation } from '~/types/api'
import { formatDate, formatMinutes, initials, priorityPresentation } from '~/utils/presentation'

const props = withDefaults(defineProps<{
  taskId?: string | null
  projectId?: string | null
  members?: PublicUser[]
  statuses?: ProjectStatus[]
  labels?: TaskLabel[]
}>(), {
  taskId: null,
  projectId: null,
  members: () => [],
  statuses: () => [],
  labels: () => [],
})

const emit = defineEmits<{
  close: []
  saved: [taskId: string]
  deleted: [taskId: string]
}>()

const details = ref<TaskDetailsResponse | null>(null)
const loading = ref(Boolean(props.taskId))
const saving = ref(false)
const deleting = ref(false)
const uploading = ref(false)
const error = ref('')
const commentError = ref('')
const activeTab = ref('details')
const previewDescription = ref(false)
const comment = ref('')
const selectedFiles = ref<File[]>([])
const confirmDelete = ref(false)
const manualMinutes = ref<number | null>(null)
const timeNote = ref('')
const { fetchUsers } = useUserDirectory()

const emptyRecurrence = (): RecurrenceRule => ({
  frequency: 'weekly',
  interval: 1,
  nextRunAt: toDateTimeInput(new Date(Date.now() + 7 * 86_400_000).toISOString())!,
  state: 'active',
})
const form = reactive<TaskMutation>({
  title: '',
  description: '',
  statusId: '',
  priority: 'normal',
  assigneeId: null,
  dueAt: null,
  labelIds: [],
  estimateMinutes: null,
  recurrence: null,
})

const availableMembers = computed(() => details.value?.members || props.members)
const availableStatuses = computed(() => details.value?.statuses || props.statuses)
const availableLabels = computed(() => details.value?.labels || props.labels)
const renderedDescription = computed(() => DOMPurify.sanitize(marked.parse(form.description || '*Описание не добавлено*') as string))
const isNew = computed(() => !props.taskId)
const project = computed(() => props.projectId || details.value?.task.projectId)
const canSave = computed(() => Boolean(form.title.trim() && form.statusId && project.value))
const priorityOptions = Object.entries(priorityPresentation).map(([value, item]) => ({ value, title: item.label }))
const recurrenceOptions = [
  { value: 'daily', title: 'Каждый день' },
  { value: 'weekly', title: 'Каждую неделю' },
  { value: 'monthly', title: 'Каждый месяц' },
  { value: 'yearly', title: 'Каждый год' },
]

watch(() => props.taskId, loadTask, { immediate: true })
watch(() => props.statuses, statuses => {
  if (isNew.value && !form.statusId && statuses.length) form.statusId = [...statuses].sort((a, b) => a.position - b.position)[0]!.id
}, { immediate: true })

async function loadTask() {
  if (!props.taskId) {
    details.value = null
    resetForm()
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { task } = await $fetch<{ task: TaskItem }>(`/api/tasks/${props.taskId}`)
    const [projectResult, labelsResult, membersResult, commentsResult, attachmentsResult, recurrenceResult, historyResult] = await Promise.allSettled([
      $fetch<{ project: unknown, statuses: ProjectStatus[] }>(`/api/projects/${task.projectId}`),
      $fetch<{ labels: TaskLabel[] }>(`/api/projects/${task.projectId}/labels`),
      fetchUsers(),
      $fetch<{ comments: CommentItem[] }>(`/api/tasks/${props.taskId}/comments`),
      $fetch<{ attachments: AttachmentItem[] }>(`/api/tasks/${props.taskId}/attachments`),
      $fetch<{ recurrence: RecurrenceItem | null }>(`/api/tasks/${props.taskId}/recurrence`),
      fetchTaskHistory(task.id),
    ])
    const statuses = projectResult.status === 'fulfilled' ? projectResult.value.statuses : props.statuses
    const labels = labelsResult.status === 'fulfilled' ? labelsResult.value.labels : props.labels
    const members = membersResult.status === 'fulfilled' ? membersResult.value : props.members
    const recurrence = recurrenceResult.status === 'fulfilled' ? recurrenceResult.value.recurrence : null
    const history = historyResult.status === 'fulfilled'
      ? historyResult.value.map(item => ({
          ...item,
          actor: item.actor || members.find(member => member.id === item.actorId),
        }))
      : []
    details.value = {
      task: {
        ...task,
        status: statuses.find(status => status.id === task.statusId),
        recurrence: recurrence ? parseRecurrence(recurrence) : null,
      },
      comments: commentsResult.status === 'fulfilled' ? commentsResult.value.comments : [],
      attachments: attachmentsResult.status === 'fulfilled' ? attachmentsResult.value.attachments : [],
      history,
      members,
      statuses,
      labels,
    }
    fillForm()
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить задачу')
  } finally {
    loading.value = false
  }
}

async function fetchTaskHistory(taskId: string): Promise<TaskHistoryItem[]> {
  try {
    const response = await $fetch<{ history: TaskHistoryItem[] }>(`/api/tasks/${taskId}/history`)
    return response.history
  } catch {
    const response = await $fetch<{ audit: Array<{ id: string, actorId: string | null, action: string, entityId: string, data: Record<string, unknown>, createdAt: string }> }>('/api/admin/audit', {
      query: { entityType: 'task', limit: 200 },
    })
    return response.audit.filter(item => item.entityId === taskId).map(item => ({
      id: item.id,
      actorId: item.actorId,
      action: item.action,
      field: Array.isArray(item.data.fields) ? item.data.fields.join(', ') : null,
      createdAt: item.createdAt,
    }))
  }
}

function resetForm() {
  Object.assign(form, {
    title: '',
    description: '',
    statusId: [...props.statuses].sort((a, b) => a.position - b.position)[0]?.id || '',
    priority: 'normal' as Priority,
    assigneeId: null,
    dueAt: null,
    labelIds: [],
    estimateMinutes: null,
    recurrence: null,
    version: undefined,
  })
}

function fillForm() {
  const task = details.value?.task
  if (!task) return
  Object.assign(form, {
    title: task.title,
    description: task.description,
    statusId: task.statusId,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueAt: toDateTimeInput(task.dueAt),
    labelIds: task.labels.map(label => label.id),
    estimateMinutes: task.estimateMinutes,
    recurrence: task.recurrence ? { ...task.recurrence, nextRunAt: toDateTimeInput(task.recurrence.nextRunAt)! } : null,
    version: task.version,
  })
  manualMinutes.value = null
  timeNote.value = ''
}

function toDateTimeInput(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function parseRecurrence(item: RecurrenceItem): RecurrenceRule {
  const values = Object.fromEntries(item.rule.replace(/^RRULE:/i, '').toLowerCase().split(';').map(part => part.split('=', 2)))
  const frequency = ['daily', 'weekly', 'monthly'].includes(values.freq || '') ? values.freq as RecurrenceRule['frequency'] : 'weekly'
  return { frequency, interval: Number(values.interval || 1), nextRunAt: item.nextRunAt, state: item.state }
}

function requestBody() {
  return {
    title: form.title.trim(),
    description: form.description,
    statusId: form.statusId,
    priority: form.priority,
    assigneeId: form.assigneeId,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    estimateMinutes: form.estimateMinutes,
    position: details.value?.task.position || 0,
    version: form.version,
  }
}

async function syncTaskExtras(taskId: string) {
  const requests: Promise<unknown>[] = [
    $fetch(`/api/tasks/${taskId}/labels`, { method: 'PUT', body: { labelIds: form.labelIds } }),
  ]
  if (form.recurrence) {
    requests.push($fetch(`/api/tasks/${taskId}/recurrence`, {
      method: 'PUT',
      body: {
        rule: `FREQ=${form.recurrence.frequency.toUpperCase()};INTERVAL=${form.recurrence.interval}`,
        timezone: useAuth().user.value?.timezone || 'UTC',
        nextRunAt: new Date(form.recurrence.nextRunAt).toISOString(),
        state: form.recurrence.state,
      },
    }))
  } else if (details.value?.task.recurrenceId) {
    requests.push($fetch(`/api/tasks/${taskId}/recurrence`, { method: 'DELETE' }))
  }
  if (manualMinutes.value && manualMinutes.value > 0) {
    requests.push($fetch(`/api/tasks/${taskId}/time-entries`, {
      method: 'POST',
      body: { minutes: manualMinutes.value, note: timeNote.value, entryDate: new Date().toISOString().slice(0, 10) },
    }))
  }
  await Promise.all(requests)
}

async function saveTask() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const response = isNew.value
      ? await $fetch<{ task: { id: string } }>('/api/tasks', { method: 'POST', body: { projectId: project.value, ...requestBody(), version: undefined, labelIds: form.labelIds } })
      : await $fetch<{ task: { id: string } }>(`/api/tasks/${props.taskId}`, { method: 'PATCH', body: requestBody() })
    await syncTaskExtras(response.task.id)
    emit('saved', response.task.id)
    if (!isNew.value) await loadTask()
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось сохранить задачу')
  } finally {
    saving.value = false
  }
}

async function addComment() {
  if (!props.taskId || !comment.value.trim()) return
  commentError.value = ''
  try {
    await $fetch(`/api/tasks/${props.taskId}/comments`, { method: 'POST', body: { body: comment.value.trim() } })
    comment.value = ''
    await loadTask()
    activeTab.value = 'comments'
  } catch (cause) {
    commentError.value = useApiError().capture(cause, 'Не удалось добавить комментарий')
  }
}

async function uploadFiles() {
  if (!props.taskId || !selectedFiles.value.length) return
  const tooLarge = selectedFiles.value.find(file => file.size > 100 * 1024 * 1024)
  if (tooLarge) {
    error.value = `Файл «${tooLarge.name}» превышает 100 МБ`
    return
  }
  uploading.value = true
  error.value = ''
  try {
    for (const file of selectedFiles.value) {
      const { attachment, uploadUrl } = await $fetch<{ attachment: { id: string }, uploadUrl: string }>(`/api/tasks/${props.taskId}/attachments/presign`, {
        method: 'POST',
        body: { fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size },
      })
      const response = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } })
      if (!response.ok) throw new Error(`Хранилище отклонило файл «${file.name}»`)
      const etag = response.headers.get('etag')?.replaceAll('"', '')
      if (!etag) throw new Error('Хранилище не вернуло ETag загруженного файла')
      await $fetch(`/api/attachments/${attachment.id}/finalize`, { method: 'POST', body: { etag } })
    }
    selectedFiles.value = []
    await loadTask()
    activeTab.value = 'attachments'
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить вложения')
  } finally {
    uploading.value = false
  }
}

async function deleteTask() {
  if (!props.taskId) return
  deleting.value = true
  try {
    await $fetch(`/api/tasks/${props.taskId}`, { method: 'DELETE' })
    emit('deleted', props.taskId)
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось переместить задачу в корзину')
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}

function memberName(id: string) {
  const user = availableMembers.value.find(member => member.id === id)
  return user?.displayName || user?.username || 'Пользователь'
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}
</script>

<template>
  <VCard class="task-detail" rounded="xl">
    <div class="task-toolbar px-4 px-sm-6 py-3">
      <div class="min-width-0">
        <div class="text-caption text-medium-emphasis">{{ details?.task ? `Задача #${details.task.number}` : 'Новая задача' }}</div>
        <div class="text-subtitle-1 font-weight-bold text-truncate">{{ form.title || 'Без названия' }}</div>
      </div>
      <VSpacer />
      <VBtn v-if="taskId" icon="mdi-delete-outline" color="error" variant="text" title="В корзину" @click="confirmDelete = true" />
      <VBtn icon="mdi-close" variant="text" aria-label="Закрыть" @click="emit('close')" />
    </div>
    <VDivider />

    <VProgressLinear v-if="loading" indeterminate color="primary" />
    <AppState v-if="error && !details && taskId" title="Задача недоступна" :text="error" icon="mdi-alert-circle-outline" action-text="Повторить" @action="loadTask" />

    <template v-else>
      <VAlert v-if="error" type="error" variant="tonal" closable class="ma-4 mb-0" @click:close="error = ''">{{ error }}</VAlert>
      <VTabs v-if="taskId" v-model="activeTab" class="px-2 px-sm-4" color="primary" show-arrows>
        <VTab value="details">Детали</VTab>
        <VTab value="comments">Комментарии <VChip class="ml-2" size="x-small">{{ details?.comments.length || 0 }}</VChip></VTab>
        <VTab value="attachments">Файлы <VChip class="ml-2" size="x-small">{{ details?.attachments.length || 0 }}</VChip></VTab>
        <VTab value="history">История</VTab>
      </VTabs>
      <VDivider v-if="taskId" />

      <VWindow v-model="activeTab">
        <VWindowItem value="details">
          <VCardText class="pa-4 pa-sm-6">
            <VTextField v-model="form.title" label="Название" autofocus :rules="[value => !!value.trim() || 'Введите название']" />
            <div class="d-flex align-center mb-2">
              <span class="text-subtitle-2">Описание</span>
              <VSpacer />
              <VBtn size="small" variant="text" :prepend-icon="previewDescription ? 'mdi-pencil-outline' : 'mdi-eye-outline'" @click="previewDescription = !previewDescription">
                {{ previewDescription ? 'Редактор' : 'Предпросмотр' }}
              </VBtn>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -- renderedDescription is sanitized with DOMPurify. -->
            <div v-if="previewDescription" class="task-description description-box" v-html="renderedDescription" />
            <VTextarea v-else v-model="form.description" placeholder="Поддерживается Markdown" rows="6" auto-grow hide-details class="mb-5" />

            <div class="fields-grid mt-5">
              <VSelect v-model="form.statusId" :items="availableStatuses" item-title="name" item-value="id" label="Статус" />
              <VSelect v-model="form.priority" :items="priorityOptions" label="Приоритет" />
              <VAutocomplete v-model="form.assigneeId" :items="availableMembers" item-title="displayName" item-value="id" label="Исполнитель" clearable />
              <VTextField v-model="form.dueAt" type="datetime-local" label="Срок" clearable />
              <VAutocomplete v-model="form.labelIds" :items="availableLabels" item-title="name" item-value="id" label="Метки" multiple chips closable-chips />
              <VTextField v-model.number="form.estimateMinutes" type="number" min="0" label="Оценка, минут" suffix="мин" clearable />
              <div class="time-entry-fields">
                <VTextField v-model.number="manualMinutes" type="number" min="1" label="Добавить время" suffix="мин" hint="Будет создана запись времени" persistent-hint />
                <VTextField v-model="timeNote" label="Комментарий ко времени" clearable />
              </div>
              <div class="recurrence-field">
                <VSwitch
                  :model-value="Boolean(form.recurrence)"
                  label="Повторять задачу"
                  color="primary"
                  hide-details
                  @update:model-value="form.recurrence = $event ? emptyRecurrence() : null"
                />
              </div>
            </div>

            <VExpandTransition>
              <div v-if="form.recurrence" class="recurrence-grid pa-4 mt-2 rounded-lg">
                <VSelect v-model="form.recurrence.frequency" :items="recurrenceOptions" label="Период" hide-details />
                <VTextField v-model.number="form.recurrence.interval" type="number" min="1" label="Интервал" hide-details />
                <VTextField v-model="form.recurrence.nextRunAt" type="datetime-local" label="Следующий запуск" hide-details />
              </div>
            </VExpandTransition>

            <div v-if="details?.task" class="d-flex flex-wrap ga-4 text-caption text-medium-emphasis mt-5">
              <span>Создана {{ formatDate(details.task.createdAt, true) }}</span>
              <span>Изменена {{ formatDate(details.task.updatedAt, true) }}</span>
              <span>Затрачено {{ formatMinutes(details.task.spentMinutes) }}</span>
            </div>
          </VCardText>
        </VWindowItem>

        <VWindowItem value="comments">
          <VCardText class="pa-4 pa-sm-6">
            <VAlert v-if="commentError" type="error" variant="tonal" class="mb-4">{{ commentError }}</VAlert>
            <VTextarea v-model="comment" label="Комментарий" placeholder="Введите @username, чтобы упомянуть участника" rows="3" auto-grow />
            <div class="d-flex justify-end mb-6"><VBtn color="primary" :disabled="!comment.trim()" @click="addComment">Отправить</VBtn></div>
            <AppState v-if="!details?.comments.length" title="Комментариев пока нет" text="Обсуждение и упоминания участников появятся здесь." icon="mdi-comment-text-outline" />
            <VList v-else lines="three" class="pa-0">
              <VListItem v-for="item in details.comments" :key="item.id" class="comment-item px-0 py-3">
                <template #prepend><VAvatar color="primary" variant="tonal" size="36">{{ initials(memberName(item.authorId)) }}</VAvatar></template>
                <VListItemTitle class="font-weight-medium">{{ memberName(item.authorId) }}</VListItemTitle>
                <VListItemSubtitle class="text-caption mb-2">{{ formatDate(item.createdAt, true) }}</VListItemSubtitle>
                <div class="text-body-2 comment-body">{{ item.body }}</div>
              </VListItem>
            </VList>
          </VCardText>
        </VWindowItem>

        <VWindowItem value="attachments">
          <VCardText class="pa-4 pa-sm-6">
            <div class="upload-row mb-5">
              <VFileInput v-model="selectedFiles" label="Выберите файлы" multiple show-size prepend-icon="mdi-paperclip" hint="До 100 МБ на файл" persistent-hint />
              <VBtn color="primary" :loading="uploading" :disabled="!selectedFiles.length" @click="uploadFiles">Загрузить</VBtn>
            </div>
            <AppState v-if="!details?.attachments.length" title="Вложений нет" text="Добавьте документы, изображения или другие материалы до 100 МБ." icon="mdi-paperclip" />
            <VList v-else class="pa-0">
              <VListItem v-for="attachment in details.attachments" :key="attachment.id" :title="attachment.fileName" :subtitle="`${formatSize(attachment.size)} · ${attachment.state === 'ready' ? 'Готов' : 'Обрабатывается'}`">
                <template #prepend><VAvatar rounded="lg" color="primary" variant="tonal"><VIcon icon="mdi-file-outline" /></VAvatar></template>
                <template #append>
                  <VBtn :href="`/api/tasks/${taskId}/attachments/${attachment.id}`" icon="mdi-download" variant="text" title="Скачать" />
                </template>
              </VListItem>
            </VList>
          </VCardText>
        </VWindowItem>

        <VWindowItem value="history">
          <VCardText class="pa-4 pa-sm-6">
            <AppState v-if="!details?.history.length" title="История пуста" text="Изменения задачи будут записываться здесь." icon="mdi-history" />
            <VTimeline v-else density="compact" side="end" truncate-line="both">
              <VTimelineItem v-for="event in details.history" :key="event.id" dot-color="primary" size="small">
                <div class="text-body-2"><strong>{{ event.actor?.displayName || 'Система' }}</strong> {{ event.action }}</div>
                <div v-if="event.field" class="text-caption text-medium-emphasis">{{ event.field }}: {{ event.from || '—' }} → {{ event.to || '—' }}</div>
                <div class="text-caption text-medium-emphasis">{{ formatDate(event.createdAt, true) }}</div>
              </VTimelineItem>
            </VTimeline>
          </VCardText>
        </VWindowItem>
      </VWindow>

      <template v-if="activeTab === 'details'">
        <VDivider />
        <VCardActions class="pa-4 px-sm-6">
          <VBtn variant="text" @click="emit('close')">Отмена</VBtn>
          <VSpacer />
          <VBtn color="primary" :loading="saving" :disabled="!canSave" @click="saveTask">{{ isNew ? 'Создать задачу' : 'Сохранить' }}</VBtn>
        </VCardActions>
      </template>
    </template>

    <VDialog v-model="confirmDelete" max-width="450">
      <VCard rounded="xl">
        <VCardTitle class="pa-6 pb-2">Переместить задачу в корзину?</VCardTitle>
        <VCardText class="px-6">Администратор сможет восстановить её до окончательного удаления.</VCardText>
        <VCardActions class="pa-6">
          <VSpacer />
          <VBtn variant="text" @click="confirmDelete = false">Отмена</VBtn>
          <VBtn color="error" :loading="deleting" @click="deleteTask">В корзину</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VCard>
</template>

<style scoped>
.task-detail {
  overflow: hidden;
}

.task-toolbar {
  display: flex;
  align-items: center;
  min-height: 68px;
}

.min-width-0 {
  min-width: 0;
}

.description-box {
  min-height: 168px;
  padding: 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}

.recurrence-field {
  min-height: 56px;
  display: flex;
  align-items: center;
}

.recurrence-grid {
  display: grid;
  grid-template-columns: 1.4fr 0.7fr 1fr;
  gap: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
}

.comment-item + .comment-item {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.comment-body {
  white-space: pre-wrap;
}

.upload-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
}

@media (max-width: 700px) {
  .fields-grid,
  .recurrence-grid,
  .upload-row {
    grid-template-columns: 1fr;
  }
}
</style>
