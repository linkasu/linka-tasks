<script setup lang="ts">
definePageMeta({ title: 'Задача' })

const route = useRoute()
const router = useRouter()
const taskId = computed(() => String(route.params.id))

function close() {
  if (window.history.length > 1) router.back()
  else navigateTo('/')
}
</script>

<template>
  <div class="page-container task-page">
    <VBtn prepend-icon="mdi-arrow-left" variant="text" class="mb-4" @click="close">Назад</VBtn>
    <TaskDetail :task-id="taskId" @close="close" @saved="() => {}" @deleted="navigateTo('/')" />
  </div>
</template>

<style scoped>
.task-page {
  max-width: 1040px;
}
</style>
