<template>
  <header class="mobile-topbar" :class="{ 'mobile-topbar--auth': showBack }">
    <div class="mobile-topbar__left">
      <button
        v-if="showBack"
        type="button"
        class="mobile-topbar__back"
        data-testid="topbar-back-button"
        aria-label="返回"
        @click="emit('back')"
      >
        <MIcon name="chevron-left" size="sm" :stroke-width="2.2" />
        <span class="mobile-topbar__space-name">{{ displayLabel }}</span>
      </button>
      <button
        v-else
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

    <div v-if="!hideActions" class="mobile-topbar__right">
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
import { computed, getCurrentInstance } from 'vue'
import { useRoute } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import { SPACE_LABELS } from './spaceConstants'

const props = withDefaults(
  defineProps<{
    currentSpace?: string
    title?: string
    showBack?: boolean
    hideActions?: boolean
  }>(),
  {
    currentSpace: 'music',
    title: undefined,
    showBack: false,
    hideActions: false,
  }
)

const emit = defineEmits<{
  (e: 'open-drawer'): void
  (e: 'search'): void
  (e: 'notifications'): void
  (e: 'back'): void
}>()

const instance = getCurrentInstance()
const hasRouter = Boolean(instance?.appContext.config.globalProperties.$router)
const route = hasRouter ? useRoute() : undefined

const displayLabel = computed(() => {
  if (props.title) return props.title
  if (route?.path === '/me') return '个人中心'
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
  height: calc(52px + env(safe-area-inset-top, 0px));
  min-height: calc(52px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  padding-right: 12px;
  padding-bottom: 0;
  padding-left: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.mobile-topbar__left {
  display: flex;
  align-items: center;
}

.mobile-topbar__back {
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

.mobile-topbar__back:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
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
