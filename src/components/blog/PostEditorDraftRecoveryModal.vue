<template>
  <PModal :title="title" :above-player="abovePlayer" size="md" @close="emit('keep')">
    <div class="draft-recovery-body">
      <span class="a-label">{{ label }}</span>
      <p class="draft-recovery-text">{{ message }}</p>
      <div class="draft-recovery-preview a-card-sm">
        <strong>{{ draftTitle || '未命名草稿' }}</strong>
        <p class="a-muted">{{ preview }}</p>
      </div>
    </div>
    <template #footer>
      <div class="draft-recovery-actions">
        <PButton type="button" variant="secondary" @click="emit('keep')">{{ keepLabel }}</PButton>
        <PButton v-if="!collabConflict" type="button" variant="ghost" @click="emit('discard')">丢弃草稿</PButton>
        <PButton type="button" variant="primary" @click="emit('restore')">恢复草稿</PButton>
      </div>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'

defineProps<{ title: string; label: string; message: string; draftTitle: string; preview: string; keepLabel: string; collabConflict: boolean; abovePlayer?: boolean }>()
const emit = defineEmits<{ keep: []; discard: []; restore: [] }>()
</script>
