<template>
  <CommentSideSheet
    :show="show"
    :title="`讨论-${debateTitle || '辩题'}`"
    :target="{ kind: 'debate', resourceId: debateId }"
    noun="讨论"
    @close="emit('close')"
  />
</template>

<script setup lang="ts">
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'

defineProps<{
  show: boolean
  debateId: string
  debateTitle?: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
