<script setup lang="ts">
import type { ProjectSummary } from '~/types/api'

definePageMeta({ title: 'Проекты' })

interface ProjectsResponse { projects: ProjectSummary[] }

const allProjects = ref<ProjectSummary[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const showArchived = ref(false)
const createOpen = ref(false)
const archiveTarget = ref<ProjectSummary | null>(null)
const form = reactive({ key: '', name: '', description: '' })
const projects = computed(() => allProjects.value.filter(project => showArchived.value || !project.archivedAt))

await loadProjects()

async function loadProjects() {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<ProjectsResponse>('/api/projects')
    allProjects.value = response.projects
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось загрузить проекты')
  } finally {
    loading.value = false
  }
}

async function createProject() {
  saving.value = true
  error.value = ''
  try {
    const response = await $fetch<{ project: ProjectSummary }>('/api/projects', {
      method: 'POST',
      body: { ...form, key: form.key.trim().toUpperCase() },
    })
    createOpen.value = false
    Object.assign(form, { key: '', name: '', description: '' })
    await navigateTo(`/projects/${response.project.id}`)
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось создать проект')
  } finally {
    saving.value = false
  }
}

async function archiveProject() {
  if (!archiveTarget.value) return
  saving.value = true
  try {
    await $fetch(`/api/projects/${archiveTarget.value.id}`, { method: 'DELETE' })
    archiveTarget.value = null
    await loadProjects()
  } catch (cause) {
    error.value = useApiError().capture(cause, 'Не удалось изменить состояние проекта')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-heading">
      <div>
        <p class="text-overline text-primary mb-1">Рабочие области</p>
        <h1 class="font-weight-black mb-2">Проекты</h1>
        <p class="text-body-1 text-medium-emphasis">Контекст, статусы и задачи команды.</p>
      </div>
      <VBtn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">Новый проект</VBtn>
    </div>

    <div class="d-flex align-center justify-space-between mb-5">
      <span class="text-body-2 text-medium-emphasis">{{ projects.length }} проектов</span>
      <VSwitch v-model="showArchived" label="Показать архив" hide-details density="compact" color="primary" />
    </div>

    <VAlert v-if="error" type="error" variant="tonal" closable class="mb-5" @click:close="error = ''">{{ error }}</VAlert>

    <div v-if="loading" class="projects-grid">
      <VSkeletonLoader v-for="index in 6" :key="index" type="card" class="surface-card" />
    </div>
    <AppState
      v-else-if="!projects.length"
      :title="showArchived ? 'Архив пуст' : 'Проектов пока нет'"
      :text="showArchived ? 'Здесь появятся архивированные проекты.' : 'Создайте первый проект и настройте рабочий процесс.'"
      icon="mdi-folder-open-outline"
      :action-text="showArchived ? '' : 'Создать проект'"
      @action="createOpen = true"
    />
    <div v-else class="projects-grid">
      <VCard v-for="project in projects" :key="project.id" class="project-card surface-card" variant="flat" :to="`/projects/${project.id}`">
        <VCardText class="pa-5">
          <div class="d-flex align-start ga-3 mb-5">
            <VAvatar color="primary" variant="tonal" rounded="lg">{{ project.key.slice(0, 2) }}</VAvatar>
            <div class="min-width-0">
              <div class="text-caption text-primary font-weight-bold mb-1">{{ project.key }}</div>
              <h2 class="text-h6 text-truncate">{{ project.name }}</h2>
            </div>
            <VMenu>
              <template #activator="{ props: menuProps }">
                <VBtn v-bind="menuProps" class="ml-auto" icon="mdi-dots-horizontal" variant="text" size="small" @click.prevent />
              </template>
              <VList density="compact">
                <VListItem
                  :prepend-icon="project.archivedAt ? 'mdi-archive-arrow-up-outline' : 'mdi-archive-outline'"
                  :title="project.archivedAt ? 'Вернуть из архива' : 'Архивировать'"
                  @click="archiveTarget = project"
                />
              </VList>
            </VMenu>
          </div>
          <p class="text-body-2 text-medium-emphasis project-description mb-5">{{ project.description || 'Описание не добавлено' }}</p>
          <div class="d-flex ga-5 text-caption text-medium-emphasis">
            <span><VIcon icon="mdi-checkbox-blank-circle-outline" size="15" /> {{ project.openTasks ?? '—' }} открыто</span>
            <span><VIcon icon="mdi-account-multiple-outline" size="15" /> {{ project.memberCount ?? '—' }}</span>
          </div>
        </VCardText>
      </VCard>
    </div>

    <VDialog v-model="createOpen" max-width="560">
      <VCard rounded="xl">
        <VCardTitle class="pa-6 pb-2">Новый проект</VCardTitle>
        <VCardText class="pa-6 pt-3">
          <VForm id="create-project" @submit.prevent="createProject">
            <VTextField v-model="form.name" label="Название" autofocus :rules="[value => !!value.trim() || 'Введите название']" />
            <VTextField v-model="form.key" label="Ключ" hint="2–8 латинских букв, например SITE" persistent-hint class="mb-3" :rules="[value => /^[A-Za-z0-9]{2,8}$/.test(value) || 'Используйте 2–8 букв или цифр']" />
            <VTextarea v-model="form.description" label="Описание" rows="3" />
          </VForm>
        </VCardText>
        <VCardActions class="pa-6 pt-0">
          <VSpacer />
          <VBtn variant="text" @click="createOpen = false">Отмена</VBtn>
          <VBtn type="submit" form="create-project" color="primary" :loading="saving" :disabled="!form.name.trim() || !/^[A-Za-z0-9]{2,8}$/.test(form.key)">Создать</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog :model-value="Boolean(archiveTarget)" max-width="460" @update:model-value="!$event && (archiveTarget = null)">
      <VCard rounded="xl">
        <VCardTitle class="pa-6 pb-2">{{ archiveTarget?.archivedAt ? 'Вернуть проект?' : 'Архивировать проект?' }}</VCardTitle>
        <VCardText class="px-6">Задачи сохранятся. Состояние проекта можно изменить позднее.</VCardText>
        <VCardActions class="pa-6">
          <VSpacer />
          <VBtn variant="text" @click="archiveTarget = null">Отмена</VBtn>
          <VBtn color="primary" :loading="saving" @click="archiveProject">Подтвердить</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 16px;
}

.project-card {
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.project-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 34px rgba(32, 45, 64, 0.1);
}

.project-description {
  min-height: 2.7em;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.min-width-0 {
  min-width: 0;
}
</style>
