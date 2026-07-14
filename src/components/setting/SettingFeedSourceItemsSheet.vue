<template>
  <PSheet
    :show="show"
    title="订阅源条目"
    close-type="header"
    @close="$emit('close')"
  >
    <div class="setting-feed-items-sheet">
      <div class="setting-feed-items-sheet__header">
        <h3>{{ sourceTitle || '订阅源条目' }}</h3>
        <p class="a-muted">查看当前订阅源条目状态，并对失败条目执行重试。</p>
      </div>

      <p v-if="error" class="setting-feed-items-sheet__message setting-feed-items-sheet__message--error">{{ error }}</p>
      <p v-else-if="loading" class="setting-feed-items-sheet__message">正在加载条目...</p>
      <p v-else-if="!items.length" class="setting-feed-items-sheet__message">当前源暂无条目。</p>

      <div v-else class="setting-feed-items-sheet__list">
        <div
          v-for="item in items"
          :key="item.id"
          class="setting-feed-items-sheet__row"
        >
          <div class="setting-feed-items-sheet__meta">
            <strong>{{ item.title || '未命名条目' }}</strong>
            <small>{{ item.link }}</small>
            <small>状态：{{ item.full_text_status }} · 尝试 {{ item.attempt_count }}</small>
            <small v-if="item.error_message">{{ item.error_message }}</small>
          </div>

          <div class="setting-feed-items-sheet__actions">
            <PButton
              v-if="item.full_text_status === 'failed'"
              size="sm"
              variant="secondary"
              @click="$emit('retry', item.id)"
            >
              重试
            </PButton>
          </div>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import type { AdminFeedFulltextItemRow } from '@/stores/adminFeedFulltext'

defineProps<{
  show: boolean
  sourceTitle: string
  items: AdminFeedFulltextItemRow[]
  loading?: boolean
  error?: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'retry', itemId: string): void
}>()
</script>

<style scoped>
.setting-feed-items-sheet {
  display: grid;
  gap: 1rem;
}

.setting-feed-items-sheet__header,
.setting-feed-items-sheet__row,
.setting-feed-items-sheet__actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.setting-feed-items-sheet__header {
  flex-direction: column;
}

.setting-feed-items-sheet__header h3,
.setting-feed-items-sheet__header p {
  margin: 0;
}

.setting-feed-items-sheet__list,
.setting-feed-items-sheet__meta {
  display: grid;
  gap: 0.75rem;
}

.setting-feed-items-sheet__row {
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.setting-feed-items-sheet__meta {
  min-width: 0;
}

.setting-feed-items-sheet__meta small,
.setting-feed-items-sheet__message {
  color: var(--a-color-ink-muted);
}

.setting-feed-items-sheet__message {
  margin: 0;
}

.setting-feed-items-sheet__message--error {
  color: var(--a-color-danger-ink);
}

@media (max-width: 720px) {
  .setting-feed-items-sheet__row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
