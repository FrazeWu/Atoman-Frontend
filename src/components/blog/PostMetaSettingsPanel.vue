<template>
  <section class="post-meta-settings-panel">
    <details class="settings-details">
      <summary class="settings-summary">
        <span class="a-label">文章摘要</span>
      </summary>
      <div class="settings-body">
        <PTextarea
          :model-value="summary"
          placeholder="留空自动截取…"
          :rows="2"
          maxlength="50"
          @update:model-value="$emit('update:summary', $event)"
        />
        <div class="summary-counter">{{ summary.length }}/50</div>
      </div>
    </details>

    <details class="settings-details">
      <summary class="settings-summary">
        <span class="a-label">可见范围</span>
      </summary>
      <div class="settings-body">
        <PSelect
          :model-value="visibility"
          label="谁可以查看这篇文章"
          :options="visibilityOptions"
          @update:model-value="$emit('update:visibility', String($event) as 'public' | 'followers' | 'private')"
        />
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

defineProps<{
  summary: string
  visibility: 'public' | 'followers' | 'private'
}>()

defineEmits<{
  (e: 'update:summary', value: string): void
  (e: 'update:visibility', value: 'public' | 'followers' | 'private'): void
}>()

const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '仅关注者', value: 'followers' },
  { label: '私密', value: 'private' },
]
</script>
