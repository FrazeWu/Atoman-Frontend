<template>
  <div
    class="notification-popover"
    data-dropdown="notification"
    role="dialog"
    aria-label="通知中心"
  >
    <!-- Popover Header -->
    <header class="popover-header">
      <div class="popover-title-group">
        <h2 class="popover-title">通知</h2>
        <span
          v-if="unreadCount > 0"
          class="popover-badge"
          data-test="popover-unread-badge"
        >
          {{ unreadCount }}
        </span>
      </div>
      <PButton
        variant="ghost"
        size="sm"
        :disabled="unreadCount === 0"
        data-test="popover-mark-all"
        @click="handleMarkAllRead"
      >
        全部已读
      </PButton>
    </header>

    <!-- Popover Body -->
    <div class="popover-body">
      <div v-if="recentNotifications.length > 0" class="popover-list">
        <NotificationItemCard
          v-for="item in recentNotifications"
          :key="item.id"
          :notification="item"
          compact
          data-test="popover-item"
          class="popover-item"
          @click="handleItemClick"
        />
      </div>
      <div v-else class="popover-empty" data-test="popover-empty">
        <PIcon name="bell-off" size="xl" class="popover-empty-icon" />
        <span>暂无未读通知</span>
      </div>
    </div>

    <!-- Popover Footer -->
    <footer class="popover-footer">
      <RouterLink
        to="/inbox"
        class="popover-footer-link"
        data-test="footer-all"
        @click.prevent="handleNavigate('/inbox')"
      >
        <span>进入收件箱查看全部</span>
        <PIcon name="arrow-right" size="sm" class="popover-footer-arrow" />
      </RouterLink>
      <RouterLink
        to="/messages"
        class="popover-footer-link"
        data-test="footer-dm"
        @click.prevent="handleNavigate('/messages')"
      >
        <span>私信</span>
        <PIcon name="arrow-right" size="sm" class="popover-footer-arrow" />
      </RouterLink>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PIcon from '@/components/ui/PIcon.vue'
import { useNotificationStore } from '@/stores/notification'
import { useInboxStore } from '@/stores/inbox'
import { notificationTargetPath } from '@/utils/notificationHelpers'
import NotificationItemCard from '@/components/notification/NotificationItemCard.vue'
import PButton from '@/components/ui/PButton.vue'

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const notificationStore = useNotificationStore()
const inboxStore = useInboxStore()

const recentNotifications = computed(() => {
  return (notificationStore.notifications || []).slice(0, 8)
})

const unreadCount = computed(() => {
  if (typeof notificationStore.unreadCount === 'number' && notificationStore.unreadCount > 0) {
    return notificationStore.unreadCount
  }
  if (typeof inboxStore.totalUnread === 'number' && inboxStore.totalUnread > 0) {
    return inboxStore.totalUnread
  }
  return (notificationStore.notifications || []).filter((n) => !n.read_at).length
})

const handleMarkAllRead = async () => {
  await notificationStore.markAllRead('all')
}

const handleItemClick = async (id: string) => {
  const item = recentNotifications.value.find((n) => n.id === id)
  if (!item) return

  if (!item.read_at) {
    await notificationStore.markRead(id)
  }

  emit('close')

  const target = notificationTargetPath(item)
  if (target) {
    router.push(target)
  } else {
    router.push('/inbox')
  }
}

const handleNavigate = (path: string) => {
  emit('close')
  router.push(path)
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

const handleGlobalOverlayOpen = (event: Event) => {
  const detail = (event as CustomEvent<string>).detail
  if (detail !== 'notification') {
    emit('close')
  }
}

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement | null
  if (!target?.closest('[data-dropdown="notification"]')) {
    emit('close')
  }
}

let cleanupClickOutside: (() => void) | null = null
let clickOutsideTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('atoman:global-overlay-open', handleGlobalOverlayOpen)

  clickOutsideTimer = setTimeout(() => {
    document.addEventListener('click', handleClickOutside)
    cleanupClickOutside = () => document.removeEventListener('click', handleClickOutside)
  }, 0)

  try {
    await notificationStore.fetchNotifications('all')
  } catch {
    // ignore fetch errors on mount
  }
})

onBeforeUnmount(() => {
  if (clickOutsideTimer) {
    clearTimeout(clickOutsideTimer)
    clickOutsideTimer = null
  }
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('atoman:global-overlay-open', handleGlobalOverlayOpen)
  if (cleanupClickOutside) {
    cleanupClickOutside()
    cleanupClickOutside = null
  }
})
</script>

<style scoped>
.notification-popover {
  width: 380px;
  max-width: calc(100vw - 2rem);
  max-height: 480px;
  display: flex;
  flex-direction: column;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-dropdown, var(--a-shadow-lg));
  box-sizing: border-box;
  text-align: left;
  user-select: none;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
}

.popover-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.popover-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--a-color-fg);
  line-height: 1.2;
}

.popover-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.35rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-danger);
  color: var(--a-color-bg);
  font-size: 0.6875rem;
  font-weight: var(--a-font-weight-strong, 600);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.popover-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.popover-list {
  display: flex;
  flex-direction: column;
}

.popover-item {
  border: none;
  border-bottom: 1px solid var(--a-color-border-soft);
  border-radius: 0;
}

.popover-item:last-child {
  border-bottom: none;
}

.popover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--a-color-muted);
}

.popover-empty-icon {
  color: var(--a-color-muted);
  opacity: 0.7;
}

.popover-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1rem;
  border-top: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  flex-shrink: 0;
}

.popover-footer-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-muted);
  text-decoration: none;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  transition: color 0.15s ease;
}

.popover-footer-link:hover {
  color: var(--a-color-fg);
  text-decoration: none;
}

.popover-footer-arrow {
  color: var(--a-color-muted);
  transition: transform 0.15s ease, color 0.15s ease;
}

.popover-footer-link:hover .popover-footer-arrow {
  transform: translateX(2px);
  color: var(--a-color-fg);
}

.popover-footer-link:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}
</style>
