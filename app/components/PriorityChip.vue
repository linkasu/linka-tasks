<script setup lang="ts">
import type { Priority } from '#shared/types'
import { priorityPresentation } from '~/utils/presentation'

defineProps<{ priority: Priority, compact?: boolean }>()
</script>

<template>
  <VChip
    :color="priorityPresentation[priority].color"
    :prepend-icon="priorityPresentation[priority].icon"
    :size="compact ? 'x-small' : 'small'"
    variant="tonal"
  >
    {{ priorityPresentation[priority].label }}
  </VChip>
</template>
