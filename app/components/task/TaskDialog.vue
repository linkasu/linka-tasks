<script setup lang="ts">
import type { ProjectStatus, PublicUser, TaskLabel } from '#shared/types'

const open = defineModel<boolean>({ default: false })
const props = withDefaults(defineProps<{
  taskId?: string | null
  projectId: string
  members?: PublicUser[]
  statuses?: ProjectStatus[]
  labels?: TaskLabel[]
}>(), {
  taskId: null,
  members: () => [],
  statuses: () => [],
  labels: () => [],
})

const emit = defineEmits<{
  saved: [taskId: string]
  deleted: [taskId: string]
}>()
const { smAndDown } = useDisplay()

function saved(taskId: string) {
  emit('saved', taskId)
  open.value = false
}

function deleted(taskId: string) {
  emit('deleted', taskId)
  open.value = false
}
</script>

<template>
  <VDialog v-model="open" :fullscreen="smAndDown" max-width="980" scrollable>
    <TaskDetail
      :task-id="props.taskId"
      :project-id="props.projectId"
      :members="props.members"
      :statuses="props.statuses"
      :labels="props.labels"
      @close="open = false"
      @saved="saved"
      @deleted="deleted"
    />
  </VDialog>
</template>
