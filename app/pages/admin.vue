<script setup lang="ts">
import type { PublicUser, Role } from '#shared/types'
import type { AuditEvent, InviteCreationResponse, InviteMutation, PaginatedResponse, TrashItem } from '~/types/api'
import { formatDate, initials, roleLabels, userStateLabels } from '~/utils/presentation'

definePageMeta({ title: 'Управление' })

const { user: currentUser } = useAuth()
if (currentUser.value?.role === 'member') await navigateTo('/')

const activeTab = ref('users')
const users = ref<PublicUser[]>([])
const audit = ref<PaginatedResponse<AuditEvent>>({ items: [], total: 0 })
const trash = ref<PaginatedResponse<TrashItem>>({ items: [], total: 0 })
const loading = ref(true)
const actionLoading = ref<string | null>(null)
const exporting = ref(false)
const error = ref('')
const inviteOpen = ref(false)
const createdInvite = ref<InviteCreationResponse | null>(null)
const inviteCopied = ref(false)
const suspensionTarget = ref<PublicUser | null>(null)
const auditAction = ref<string | null>(null)
const invite = reactive<InviteMutation>({ username: '', role: 'member' })
const inviteSecret = computed(() => createdInvite.value?.startUrl || createdInvite.value?.token || '')
const roles = Object.entries(roleLabels).map(([value, title]) => ({ value, title }))
const auditActions = [
  { value: 'user', title: 'Пользователи' },
  { value: 'project', title: 'Проекты' },
  { value: 'task', title: 'Задачи' },
  { value: 'invite', title: 'Приглашения' },
]

await Promise.all([loadUsers(), loadAudit(), loadTrash()])
loading.value = false
watch(auditAction, loadAudit)

async function loadUsers() {
  try {
    const response = await $fetch<{ users: PublicUser[] }>('/api/admin/users')
    users.value = response.users
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить пользователей')
  }
}

async function loadAudit() {
  try {
    const response = await $fetch<{ audit: AuditEvent[], total: number }>('/api/admin/audit', {
      query: { entityType: auditAction.value || undefined, limit: 200 },
    })
    audit.value = { items: response.audit, total: response.total }
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить аудит')
  }
}

async function loadTrash() {
  try {
    const response = await $fetch<{ tasks: Array<{ id: string, title: string, deletedAt: string | null }>, total: number }>('/api/tasks', {
      query: { trash: 'true', limit: 200 },
    })
    trash.value = {
      items: response.tasks.flatMap(task => task.deletedAt ? [{ id: task.id, type: 'task' as const, title: task.title, deletedAt: task.deletedAt }] : []),
      total: response.total,
    }
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить корзину')
  }
}

async function sendInvite() {
  actionLoading.value = 'invite'
  error.value = ''
  try {
    const response = await $fetch<InviteCreationResponse>('/api/admin/invites', {
      method: 'POST',
      body: { username: invite.username.replace(/^@/, '').trim(), role: invite.role, expiresInHours: 72 },
    })
    createdInvite.value = response
    inviteCopied.value = false
    Object.assign(invite, { username: '', role: 'member' as Role })
    await loadUsers()
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось отправить приглашение')
  } finally {
    actionLoading.value = null
  }
}

function openInviteDialog() {
  createdInvite.value = null
  inviteCopied.value = false
  inviteOpen.value = true
}

function closeInviteDialog() {
  inviteOpen.value = false
  createdInvite.value = null
  inviteCopied.value = false
}

async function copyInviteSecret() {
  if (!inviteSecret.value) return
  try {
    await navigator.clipboard.writeText(inviteSecret.value)
    inviteCopied.value = true
  } catch {
    error.value = 'Не удалось скопировать приглашение. Скопируйте значение из поля вручную.'
  }
}

async function updateRole(target: PublicUser, role: Role) {
  if (target.id === currentUser.value?.id || target.role === role) return
  actionLoading.value = target.id
  try {
    await $fetch(`/api/admin/users/${target.id}`, { method: 'PATCH', body: { role } })
    await loadUsers()
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось изменить роль')
  } finally {
    actionLoading.value = null
  }
}

async function toggleSuspension() {
  const target = suspensionTarget.value
  if (!target) return
  actionLoading.value = target.id
  try {
    await $fetch(`/api/admin/users/${target.id}`, {
      method: 'PATCH',
      body: { state: target.state === 'suspended' ? 'active' : 'suspended' },
    })
    suspensionTarget.value = null
    await loadUsers()
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось изменить доступ пользователя')
  } finally {
    actionLoading.value = null
  }
}

async function restoreItem(item: TrashItem) {
  actionLoading.value = item.id
  try {
    await $fetch(`/api/tasks/${item.id}/restore`, { method: 'POST' })
    await loadTrash()
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось восстановить объект')
  } finally {
    actionLoading.value = null
  }
}

async function exportData() {
  exporting.value = true
  try {
    const blob = await $fetch<Blob>('/api/admin/export', { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `linka-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось подготовить экспорт')
  } finally {
    exporting.value = false
  }
}

function stateColor(state: PublicUser['state']) {
  return { active: 'success', invited: 'warning', suspended: 'error' }[state]
}

function entityLabel(type: TrashItem['type']) {
  return { task: 'Задача', project: 'Проект', attachment: 'Файл' }[type]
}

function auditActor(actorId: string | null | undefined) {
  return users.value.find(member => member.id === actorId)?.displayName || (actorId ? 'Пользователь' : 'Система')
}
</script>

<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <p class="text-overline text-primary mb-1">Администрирование</p>
        <h1 class="font-weight-black mb-2">Управление</h1>
        <p class="text-body-1 text-medium-emphasis">Люди, безопасность и данные рабочего пространства.</p>
      </div>
      <div class="d-flex ga-2 admin-actions">
        <VBtn variant="tonal" prepend-icon="mdi-database-export-outline" :loading="exporting" @click="exportData">Экспорт</VBtn>
        <VBtn color="primary" prepend-icon="mdi-account-plus-outline" @click="openInviteDialog">Пригласить</VBtn>
      </div>
    </div>

    <VAlert v-if="error" type="error" variant="tonal" closable class="mb-5" @click:close="error = ''">{{ error }}</VAlert>

    <VCard class="surface-card overflow-hidden" variant="flat">
      <VTabs v-model="activeTab" color="primary" show-arrows class="px-2">
        <VTab value="users" prepend-icon="mdi-account-multiple-outline">Пользователи</VTab>
        <VTab value="audit" prepend-icon="mdi-shield-search-outline">Аудит</VTab>
        <VTab value="trash" prepend-icon="mdi-delete-clock-outline">Корзина</VTab>
      </VTabs>
      <VDivider />
      <VProgressLinear v-if="loading" indeterminate color="primary" />

      <VWindow v-model="activeTab">
        <VWindowItem value="users">
          <AppState v-if="!loading && !users.length" title="Пользователей нет" text="Пригласите первого участника команды." icon="mdi-account-plus-outline" action-text="Пригласить" @action="openInviteDialog" />
          <VList v-else class="pa-0" lines="two">
            <VListItem v-for="member in users" :key="member.id" class="user-row px-4 px-sm-6 py-3">
              <template #prepend>
                <VAvatar color="primary" variant="tonal">{{ initials(member.displayName || member.username) }}</VAvatar>
              </template>
              <VListItemTitle class="font-weight-medium">{{ member.displayName || `@${member.username}` }}</VListItemTitle>
              <VListItemSubtitle>@{{ member.username }} · {{ member.timezone }}</VListItemSubtitle>
              <template #append>
                <div class="user-controls">
                  <VChip :color="stateColor(member.state)" size="small" variant="tonal">{{ userStateLabels[member.state] }}</VChip>
                  <VSelect
                    :model-value="member.role"
                    :items="roles"
                    density="compact"
                    hide-details
                    aria-label="Роль"
                    :disabled="member.id === currentUser?.id || actionLoading === member.id"
                    @update:model-value="updateRole(member, $event as Role)"
                  />
                  <VBtn
                    :icon="member.state === 'suspended' ? 'mdi-account-check-outline' : 'mdi-account-cancel-outline'"
                    :color="member.state === 'suspended' ? 'success' : 'error'"
                    variant="text"
                    :disabled="member.id === currentUser?.id"
                    :loading="actionLoading === member.id"
                    :title="member.state === 'suspended' ? 'Возобновить доступ' : 'Приостановить доступ'"
                    @click="suspensionTarget = member"
                  />
                </div>
              </template>
            </VListItem>
          </VList>
        </VWindowItem>

        <VWindowItem value="audit">
          <div class="d-flex justify-end pa-4 pb-0">
            <VSelect v-model="auditAction" :items="auditActions" label="Категория" clearable hide-details density="compact" max-width="260" />
          </div>
          <AppState v-if="!loading && !audit.items.length" title="Событий нет" text="Действия администраторов и пользователей появятся здесь." icon="mdi-shield-check-outline" />
          <VTable v-else hover class="audit-table">
            <thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>Данные</th></tr></thead>
            <tbody>
              <tr v-for="event in audit.items" :key="event.id">
                <td class="text-no-wrap">{{ formatDate(event.createdAt, true) }}</td>
                <td>{{ event.actor?.displayName || auditActor(event.actorId) }}</td>
                <td><code>{{ event.action }}</code></td>
                <td>{{ event.entityType }}<span v-if="event.entityId" class="text-medium-emphasis"> · {{ event.entityId }}</span></td>
                <td class="text-caption text-medium-emphasis">{{ event.data ? JSON.stringify(event.data) : '—' }}</td>
              </tr>
            </tbody>
          </VTable>
        </VWindowItem>

        <VWindowItem value="trash">
          <VAlert type="info" variant="tonal" class="ma-4 mb-0">Удалённые объекты доступны для восстановления до даты окончательного удаления.</VAlert>
          <AppState v-if="!loading && !trash.items.length" title="Корзина пуста" text="Удалённые задачи, проекты и файлы появятся здесь." icon="mdi-delete-empty-outline" />
          <VList v-else class="pa-0 mt-4">
            <VListItem v-for="item in trash.items" :key="`${item.type}-${item.id}`" class="user-row px-4 px-sm-6 py-3" :title="item.title">
              <template #prepend><VAvatar color="error" variant="tonal"><VIcon icon="mdi-delete-outline" /></VAvatar></template>
              <VListItemSubtitle>{{ entityLabel(item.type) }} · удалено {{ formatDate(item.deletedAt, true) }}<span v-if="item.purgeAt"> · окончательно {{ formatDate(item.purgeAt) }}</span></VListItemSubtitle>
              <template #append><VBtn prepend-icon="mdi-restore" variant="tonal" color="primary" :loading="actionLoading === item.id" @click="restoreItem(item)">Восстановить</VBtn></template>
            </VListItem>
          </VList>
        </VWindowItem>
      </VWindow>
    </VCard>

    <VDialog :model-value="inviteOpen" max-width="520" @update:model-value="!$event && closeInviteDialog()">
      <VCard rounded="xl">
        <VCardTitle class="pa-6 pb-2">{{ createdInvite ? 'Приглашение создано' : 'Пригласить участника' }}</VCardTitle>
        <VCardText class="pa-6 pt-3">
          <template v-if="createdInvite">
            <VAlert type="warning" variant="tonal" class="mb-4">
              Сохраните приглашение для @{{ createdInvite.invite.username }} сейчас. Токен показывается только в этом ответе.
            </VAlert>
            <VTextField
              :model-value="inviteSecret"
              :label="createdInvite.startUrl ? 'Ссылка Telegram' : 'Одноразовый токен'"
              readonly
              hide-details
              @focus="$event.target.select()"
            />
          </template>
          <VForm v-else id="invite-form" @submit.prevent="sendInvite">
            <VTextField v-model="invite.username" label="Telegram username" prefix="@" autofocus :rules="[value => !!value.replace(/^@/, '').trim() || 'Введите username']" />
            <VSelect v-model="invite.role" :items="roles" label="Роль" />
          </VForm>
        </VCardText>
        <VCardActions class="pa-6 pt-0">
          <VSpacer />
          <template v-if="createdInvite">
            <VBtn v-if="createdInvite.startUrl" variant="text" :href="createdInvite.startUrl" target="_blank" rel="noopener">Открыть</VBtn>
            <VBtn color="primary" prepend-icon="mdi-content-copy" @click="copyInviteSecret">{{ inviteCopied ? 'Скопировано' : 'Копировать' }}</VBtn>
            <VBtn variant="text" @click="closeInviteDialog">Закрыть</VBtn>
          </template>
          <template v-else>
            <VBtn variant="text" @click="closeInviteDialog">Отмена</VBtn>
            <VBtn type="submit" form="invite-form" color="primary" :loading="actionLoading === 'invite'" :disabled="!invite.username.replace(/^@/, '').trim()">Отправить</VBtn>
          </template>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog :model-value="Boolean(suspensionTarget)" max-width="460" @update:model-value="!$event && (suspensionTarget = null)">
      <VCard rounded="xl">
        <VCardTitle class="pa-6 pb-2">{{ suspensionTarget?.state === 'suspended' ? 'Возобновить доступ?' : 'Приостановить доступ?' }}</VCardTitle>
        <VCardText class="px-6">{{ suspensionTarget?.displayName }} {{ suspensionTarget?.state === 'suspended' ? 'снова сможет войти в систему.' : 'потеряет доступ, но его данные сохранятся.' }}</VCardText>
        <VCardActions class="pa-6">
          <VSpacer />
          <VBtn variant="text" @click="suspensionTarget = null">Отмена</VBtn>
          <VBtn :color="suspensionTarget?.state === 'suspended' ? 'success' : 'error'" :loading="actionLoading === suspensionTarget?.id" @click="toggleSuspension">Подтвердить</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.user-row + .user-row {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.user-controls {
  width: 390px;
  display: grid;
  grid-template-columns: 110px 1fr auto;
  align-items: center;
  gap: 10px;
}

.audit-table {
  min-width: 760px;
}

code {
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}

@media (max-width: 760px) {
  .admin-actions {
    display: grid !important;
    grid-template-columns: 1fr 1fr;
  }

  .user-row :deep(.v-list-item__append) {
    width: 100%;
    margin-inline-start: 0;
    padding-top: 12px;
  }

  .user-row {
    flex-wrap: wrap;
  }

  .user-controls {
    width: 100%;
    grid-template-columns: 1fr 1.4fr auto;
  }
}

@media (max-width: 480px) {
  .admin-actions,
  .user-controls {
    grid-template-columns: 1fr;
  }
}
</style>
