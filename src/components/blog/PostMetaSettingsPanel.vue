<template>
  <section class="post-meta-settings-panel">
    <details class="settings-details">
      <summary class="settings-summary">
        <span class="a-label">文章摘要</span>
      </summary>
      <div class="settings-body">
        <textarea
          :value="summary"
          placeholder="留空自动截取…"
          rows="2"
          maxlength="50"
          class="a-textarea settings-textarea"
          @input="$emit('update:summary', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="summary-counter">{{ summary.length }}/50</div>
      </div>
    </details>

    <details class="settings-details">
      <summary class="settings-summary">
        <span class="a-label">可见范围</span>
      </summary>
      <div class="settings-body">
        <ASelect
          :model-value="visibility"
          label="谁可以查看这篇文章"
          :options="visibilityOptions"
          @update:model-value="$emit('update:visibility', String($event) as 'public' | 'followers' | 'private')"
        />
      </div>
    </details>

    <details class="settings-details">
      <summary class="settings-summary">
        <span class="a-label">评论设置</span>
      </summary>
      <div class="settings-body">
        <label class="option-check a-card-sm">
          <input type="checkbox" :checked="allowComments" @change="$emit('update:allowComments', ($event.target as HTMLInputElement).checked)" />
          <span>允许评论</span>
        </label>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import ASelect from '@/components/ui/ASelect.vue'

defineProps<{
  summary: string
  visibility: 'public' | 'followers' | 'private'
  allowComments: boolean
}>()

defineEmits<{
  (e: 'update:summary', value: string): void
  (e: 'update:visibility', value: 'public' | 'followers' | 'private'): void
  (e: 'update:allowComments', value: boolean): void
}>()

const visibilityOptions = [
  { label: '公开', value: 'public' },
  { label: '仅关注者', value: 'followers' },
  { label: '私密', value: 'private' },
]
</script>
