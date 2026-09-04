<template>
  <TransitionGroup
    tag="aside"
    name="notification-toast"
    class="notification-toast-stack"
    aria-label="新通知"
    aria-live="polite"
    aria-atomic="false"
  >
    <button
      v-for="(toast, index) in inboxStore.toastItems"
      :key="toast.id"
      type="button"
      class="notification-toast"
      :class="{ 'notification-toast--announcement': toast.isAnnouncement }"
      :data-toast-id="toast.id"
      :style="{ bottom: `${index * toastStep}rem` }"
      @click="openToast(toast.id, toast.href)"
      @pointerenter="pauseToast(toast.id)"
      @pointerleave="resumeToast(toast.id)"
      @focusin="pauseToast(toast.id)"
      @focusout="resumeToast(toast.id)"
    >
      <span class="notification-toast__content">
        <span class="notification-toast__type">{{ typeLabel(toast.kind, toast.isAnnouncement) }}</span>
        <strong class="notification-toast__title">{{ toast.title }}</strong>
        <span class="notification-toast__body">{{ toast.body }}</span>
      </span>
    </button>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useInboxStore, type InboxToastItem } from '@/stores/inbox'

const toastDuration = 8000
const resumeDuration = 3500
const toastStep = 5.875

const router = useRouter()
const inboxStore = useInboxStore()
const timers = new Map<string, number>()

const typeLabel = (kind: InboxToastItem['kind'], isAnnouncement: boolean) => {
  if (isAnnouncement) return '站点公告'
  return kind === 'dm' ? '私信' : '通知'
}

const clearTimer = (id: string) => {
  const timer = timers.get(id)
  if (timer === undefined) return
  window.clearTimeout(timer)
  timers.delete(id)
}

const startTimer = (id: string, duration = toastDuration) => {
  clearTimer(id)
  timers.set(id, window.setTimeout(() => {
    timers.delete(id)
    inboxStore.dismissToast(id)
  }, duration))
}

const pauseToast = (id: string) => {
  clearTimer(id)
}

const resumeToast = (id: string) => {
  if (inboxStore.toastItems.some((item) => item.id === id)) startTimer(id, resumeDuration)
}

const openToast = async (id: string, href: string) => {
  clearTimer(id)
  inboxStore.dismissToast(id)
  await router.push(href)
}

watch(
  () => inboxStore.toastItems.map((item) => item.id),
  (ids) => {
    const active = new Set(ids)
    timers.forEach((_, id) => {
      if (!active.has(id)) clearTimer(id)
    })
    ids.forEach((id) => {
      if (!timers.has(id)) startTimer(id)
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  timers.forEach((_, id) => clearTimer(id))
})
</script>

<style scoped>
.notification-toast-stack {
  width: min(21rem, calc(100vw - 2rem));
  height: 21rem;
  position: fixed;
  z-index: var(--a-z-toast);
  top: calc(var(--a-topbar-height, 3.75rem) + 1rem);
  right: clamp(1rem, 4vw, 4rem);
  pointer-events: none;
}

.notification-toast {
  width: 100%;
  min-height: 5.25rem;
  position: absolute;
  right: 0;
  display: block;
  overflow: hidden;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-none);
  padding: 0.8rem 0.9rem;
  background: var(--a-color-surface);
  color: var(--a-color-text);
  cursor: pointer;
  pointer-events: auto;
  text-align: left;
  transition:
    bottom var(--a-motion-state) var(--a-motion-ease-enter),
    opacity var(--a-motion-state) var(--a-motion-ease-enter);
}

.notification-toast:hover {
  border-color: var(--a-color-text);
}

.notification-toast:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.notification-toast--announcement {
  border-left: 3px solid var(--a-color-success);
}

.notification-toast__content {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.notification-toast__type {
  color: var(--a-color-text-secondary);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0;
}

.notification-toast--announcement .notification-toast__type {
  color: var(--a-color-success);
}

.notification-toast__title,
.notification-toast__body {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-toast__title {
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.35;
}

.notification-toast__body {
  color: var(--a-color-text-secondary);
  font-size: 0.76rem;
  line-height: 1.35;
}

.notification-toast-enter-active,
.notification-toast-leave-active {
  transition: opacity var(--a-motion-state) var(--a-motion-ease-enter);
}

.notification-toast-enter-from,
.notification-toast-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .notification-toast-stack {
    width: 100%;
    height: 18rem;
    top: auto;
    right: 0;
    bottom: var(--a-content-bottom-offset, 1rem);
  }

  .notification-toast {
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
  }

  .notification-toast--announcement {
    border-left: 3px solid var(--a-color-success);
  }
}

</style>
