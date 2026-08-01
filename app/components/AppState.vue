<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  text?: string
  icon?: string
  actionText?: string
}>(), {
  text: '',
  icon: 'mdi-inbox-outline',
  actionText: '',
})

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="app-state text-center pa-8 pa-sm-12">
    <VIcon :icon="icon" size="52" color="medium-emphasis" class="mb-4" />
    <h2 class="text-h6 mb-2">{{ title }}</h2>
    <p v-if="text" class="text-body-2 text-medium-emphasis mx-auto mb-5">{{ text }}</p>
    <VBtn v-if="actionText" color="primary" variant="tonal" @click="$emit('action')">{{ actionText }}</VBtn>
  </div>
</template>

<style scoped>
.app-state {
  min-height: 260px;
  display: grid;
  place-content: center;
}

.app-state p {
  max-width: 32rem;
}
</style>
