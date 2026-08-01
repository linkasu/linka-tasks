<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { ProjectStatus, PublicUser, TaskItem } from '#shared/types'

interface Lane {
  status: ProjectStatus
  tasks: TaskItem[]
}

const props = defineProps<{
  statuses: ProjectStatus[]
  tasks: TaskItem[]
  members: PublicUser[]
  canEdit?: boolean
}>()

const emit = defineEmits<{
  open: [task: TaskItem]
  moveTask: [payload: { taskId: string, statusId: string, position: number, version: number }]
  reorderStatuses: [statusIds: string[]]
}>()

const lanes = ref<Lane[]>([])

function syncLanes() {
  lanes.value = [...props.statuses]
    .sort((a, b) => a.position - b.position)
    .map(status => ({
      status,
      tasks: props.tasks
        .filter(task => task.statusId === status.id)
        .sort((a, b) => a.position - b.position),
    }))
}

watch(() => [props.statuses, props.tasks], syncLanes, { deep: true, immediate: true })

function onTaskEnd(event: { item: HTMLElement, to: HTMLElement, newIndex?: number }) {
  const taskId = event.item.dataset.taskId
  const statusId = event.to.dataset.statusId
  if (!taskId || !statusId) return
  const task = props.tasks.find(item => item.id === taskId)
  if (!task) return
  emit('moveTask', { taskId, statusId, position: event.newIndex ?? 0, version: task.version })
}

function onStatusesEnd() {
  emit('reorderStatuses', lanes.value.map(lane => lane.status.id))
}

function assigneeFor(task: TaskItem) {
  return props.members.find(member => member.id === task.assigneeId)
}
</script>

<template>
  <div class="kanban-scroll">
    <VueDraggable
      v-model="lanes"
      class="kanban-board"
      handle=".lane-handle"
      :disabled="!canEdit"
      :animation="180"
      @end="onStatusesEnd"
    >
      <section v-for="lane in lanes" :key="lane.status.id" class="kanban-lane">
        <header class="d-flex align-center ga-2 px-2 mb-3">
          <VIcon v-if="canEdit" class="lane-handle" icon="mdi-drag" size="18" />
          <span class="status-dot" :style="{ background: lane.status.color }" />
          <h2 class="text-subtitle-2 font-weight-bold">{{ lane.status.name }}</h2>
          <VChip size="x-small" class="ml-auto">{{ lane.tasks.length }}</VChip>
        </header>
        <VueDraggable
          v-model="lane.tasks"
          class="lane-tasks"
          :data-status-id="lane.status.id"
          group="project-tasks"
          :disabled="!canEdit"
          :animation="180"
          ghost-class="task-ghost"
          @end="onTaskEnd"
        >
          <div v-for="task in lane.tasks" :key="task.id" :data-task-id="task.id">
            <TaskCard :task="task" :assignee="assigneeFor(task)" @open="emit('open', $event)" />
          </div>
          <div v-if="!lane.tasks.length" class="lane-empty text-caption text-medium-emphasis">Перетащите задачу сюда</div>
        </VueDraggable>
      </section>
    </VueDraggable>
  </div>
</template>

<style scoped>
.kanban-scroll {
  overflow-x: auto;
  margin-inline: -8px;
  padding: 4px 8px 20px;
}

.kanban-board {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: min-content;
}

.kanban-lane {
  width: 310px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(var(--v-theme-on-background), 0.035);
}

.lane-handle {
  cursor: grab;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.lane-tasks {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 130px;
}

.lane-empty {
  display: grid;
  min-height: 108px;
  place-items: center;
  padding: 16px;
  border: 1px dashed rgba(var(--v-border-color), 0.3);
  border-radius: 14px;
}

.task-ghost {
  opacity: 0.35;
}

@media (max-width: 600px) {
  .kanban-lane {
    width: min(86vw, 300px);
  }
}
</style>
