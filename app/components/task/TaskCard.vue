<script setup lang="ts">
import type { ProjectStatus, PublicUser, TaskItem } from '#shared/types'
import { formatDate, formatMinutes, initials } from '~/utils/presentation'

const props = defineProps<{
  task: TaskItem
  status?: ProjectStatus
  assignee?: PublicUser
  showStatus?: boolean
}>()

defineEmits<{ open: [task: TaskItem] }>()

const overdue = computed(() => props.task.dueAt && new Date(props.task.dueAt) < new Date() && !props.status?.isDone)
</script>

<template>
  <VCard
    class="task-card surface-card"
    variant="flat"
    tabindex="0"
    role="button"
    @click="$emit('open', task)"
    @keydown.enter="$emit('open', task)"
  >
    <VCardText class="pa-4">
      <div class="d-flex align-start ga-3 mb-3">
        <span class="text-caption text-medium-emphasis font-weight-medium">#{{ task.number }}</span>
        <VSpacer />
        <PriorityChip :priority="task.priority" compact />
      </div>
      <div class="text-body-1 font-weight-medium mb-3 task-title">{{ task.title }}</div>
      <div v-if="task.labels.length" class="d-flex flex-wrap ga-1 mb-3">
        <VChip
          v-for="label in task.labels"
          :key="label.id"
          size="x-small"
          :color="label.color"
          variant="tonal"
        >
          {{ label.name }}
        </VChip>
      </div>
      <div class="d-flex align-center ga-2 text-caption text-medium-emphasis">
        <VChip v-if="showStatus && status" size="x-small" :color="status.color" variant="tonal">
          {{ status.name }}
        </VChip>
        <span v-if="task.dueAt" :class="{ 'text-error font-weight-bold': overdue }">
          <VIcon icon="mdi-calendar-outline" size="14" />
          {{ formatDate(task.dueAt, true) }}
        </span>
        <span v-if="task.estimateMinutes" class="ml-auto">
          <VIcon icon="mdi-timer-sand" size="14" /> {{ formatMinutes(task.estimateMinutes) }}
        </span>
        <VAvatar v-if="assignee" :title="assignee.displayName" size="24" color="primary" variant="tonal">
          <span class="text-caption">{{ initials(assignee.displayName || assignee.username) }}</span>
        </VAvatar>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.task-card {
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

.task-card:hover,
.task-card:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(var(--v-theme-primary), 0.45);
  box-shadow: 0 12px 26px rgba(32, 45, 64, 0.09);
  outline: none;
}

.task-title {
  line-height: 1.35;
}
</style>
