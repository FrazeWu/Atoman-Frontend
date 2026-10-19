<template>
  <header class="mobile-topbar">
    <div class="mobile-topbar__left">
      <button
        type="button"
        class="mobile-topbar__trigger"
        data-testid="space-trigger"
        aria-label="切换空间"
        @click="emit('open-drawer')"
      >
        <span class="mobile-topbar__space-name">{{ displayLabel }}</span>
        <MIcon name="chevron-down" size="xs" :stroke-width="2.2" class="mobile-topbar__trigger-arrow" />
      </button>
    </div>

    <div class="mobile-topbar__right">
      <button
        type="button"
        class="mobile-topbar__action"
        data-testid="search-button"
        aria-label="搜索"
        @click="emit('search')"
      >
        <MIcon name="search" size="md" :stroke-width="1.8" />
      </button>
      <button
        type="button"
        class="mobile-topbar__action"
        data-testid="notifications-button"
        aria-label="通知"
        @click="emit('notifications')"
      >
        <MIcon name="bell" size="md" :stroke-width="1.8" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { SPACE_LABELS } from './spaceConstants'

const props = withDefaults(
  defineProps<{
    currentSpace?: string
    title?: string
  }>(),
  {
    currentSpace: 'music',
    title: undefined,
  }
)

const emit = defineEmits<{
  (e: 'open-drawer'): void
  (e: 'search'): void
  (e: 'notifications'): void
}>()

const displayLabel = computed(() => {
  if (props.title) return props.title
  const key = props.currentSpace?.toLowerCase() || 'music'
  return SPACE_LABELS[key] || props.currentSpace || 'Atoman'
})
</script>

<style scoped>
.mobile-topbar {
  position: sticky;
  top: 0;
  z-index: var(--a-z-navigation, 100);
  width: 100%;
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.mobile-topbar__left {
  display: flex;
  align-items: center;
}

.mobile-topbar__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-fg, #0f172a);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.mobile-topbar__trigger:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
}

.mobile-topbar__space-name {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.mobile-topbar__trigger-arrow {
  color: var(--a-color-muted, #64748b);
  margin-top: 1px;
}

.mobile-topbar__right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mobile-topbar__action {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-fg, #0f172a);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mobile-topbar__action:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
}
</style>
