<template>
  <div class="subscription-inbox-toolbar" aria-label="订阅收件箱工具栏">
    <PSegmentedControl
      v-model="mode"
      :options="modeOptions"
      aria-label="订阅内容筛选"
      data-test="subscription-inbox-mode"
    />

    <div class="subscription-inbox-toolbar__actions">
      <span v-if="syncLabel" class="subscription-inbox-toolbar__sync a-font-meta" aria-live="polite">
        {{ syncLabel }}
      </span>
      <PButton
        variant="ghost"
        size="sm"
        :loading="refreshing"
        aria-label="刷新订阅内容"
        data-test="subscription-inbox-refresh"
        @click="emit('refresh')"
      >
        <RefreshCw :size="15" aria-hidden="true" />
        刷新
      </PButton>
      <PButton
        variant="secondary"
        size="sm"
        :loading="markingAllRead"
        loading-text="处理中..."
        data-test="subscription-inbox-mark-all-read"
        @click="emit('mark-all-read')"
      >
        <CheckCheck :size="15" aria-hidden="true" />
        全部已读
      </PButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconChecks as CheckCheck, IconRefresh as RefreshCw } from '@tabler/icons-vue'

import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

const props = withDefaults(defineProps<{
  unreadOnly: boolean
  markingAllRead: boolean
  refreshing: boolean
  lastSyncedAt: string
}>(), {
  unreadOnly: false,
  markingAllRead: false,
  refreshing: false,
  lastSyncedAt: '',
})

const emit = defineEmits<{
  'update:unreadOnly': [value: boolean]
  'toggle-unread': []
  refresh: []
  'mark-all-read': []
}>()

const mode = computed<'all' | 'unread'>({
  get: () => props.unreadOnly ? 'unread' : 'all',
  set: value => {
    const nextUnread = value === 'unread'
    emit('update:unreadOnly', nextUnread)
    emit('toggle-unread')
  },
})

const modeOptions = [
  { label: '全部', value: 'all', test: 'subscription-inbox-all' },
  { label: '未读', value: 'unread', test: 'subscription-inbox-unread' },
]

const syncLabel = computed(() => {
  if (!props.lastSyncedAt) return ''
  const date = new Date(props.lastSyncedAt)
  if (Number.isNaN(date.getTime())) return ''
  const elapsed = Date.now() - date.getTime()
  if (elapsed >= 0 && elapsed < 60_000) return '刚刚同步'
  return `上次同步 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
})
</script>

<style scoped>
.subscription-inbox-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
  min-height: 2.5rem;
}

.subscription-inbox-toolbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.subscription-inbox-toolbar__sync {
  color: var(--a-color-muted);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .subscription-inbox-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .subscription-inbox-toolbar__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
