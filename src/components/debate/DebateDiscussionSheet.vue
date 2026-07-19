<template>
  <PSheet
    :show="show"
    title="讨论"
    width="min(100%, 720px)"
    close-type="header"
    @close="emit('close')"
  >
    <CommentSection :target="{ kind: 'debate', resourceId: debateId }" noun="讨论" />
  </PSheet>
</template>

<script setup lang="ts">
import CommentSection from '@/components/comment/CommentSection.vue'
import PSheet from '@/components/ui/PSheet.vue'

defineProps<{
  show: boolean
  debateId: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
