<script setup lang="ts">
import type { Priority, PublicUser, TaskLabel } from '#shared/types'
import { priorityPresentation } from '~/utils/presentation'

const q = defineModel<string>('q', { default: '' })
const assignee = defineModel<string | null>('assignee', { default: null })
const label = defineModel<string | null>('label', { default: null })
const priority = defineModel<Priority | null>('priority', { default: null })
const due = defineModel<string | null>('due', { default: null })

defineProps<{ members: PublicUser[], labels: TaskLabel[], compact?: boolean }>()

const priorities = Object.entries(priorityPresentation).map(([value, item]) => ({ value, title: item.label }))
const dueOptions = [
  { value: 'overdue', title: 'Просрочено' },
  { value: 'today', title: 'Сегодня' },
  { value: 'week', title: 'На этой неделе' },
  { value: 'none', title: 'Без срока' },
]

function clear() {
  q.value = ''
  assignee.value = null
  label.value = null
  priority.value = null
  due.value = null
}

const hasFilters = computed(() => Boolean(q.value || assignee.value || label.value || priority.value || due.value))
</script>

<template>
  <VCard class="surface-card mb-5" variant="flat">
    <VCardText :class="compact ? 'pa-3' : 'pa-4'">
      <div class="filters-grid">
        <VTextField
          v-model="q"
          label="Поиск"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          density="compact"
        />
        <VSelect
          v-model="assignee"
          :items="members"
          item-title="displayName"
          item-value="id"
          label="Исполнитель"
          clearable
          hide-details
          density="compact"
        />
        <VSelect
          v-model="label"
          :items="labels"
          item-title="name"
          item-value="id"
          label="Метка"
          clearable
          hide-details
          density="compact"
        />
        <VSelect
          v-model="priority"
          :items="priorities"
          label="Приоритет"
          clearable
          hide-details
          density="compact"
        />
        <VSelect
          v-model="due"
          :items="dueOptions"
          label="Срок"
          clearable
          hide-details
          density="compact"
        />
        <VBtn v-if="hasFilters" icon="mdi-filter-remove-outline" variant="text" title="Сбросить фильтры" @click="clear" />
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.filters-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1.6fr) repeat(4, minmax(145px, 1fr)) auto;
  align-items: center;
  gap: 10px;
}

@media (max-width: 1100px) {
  .filters-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }
}
</style>
