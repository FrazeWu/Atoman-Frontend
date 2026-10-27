<template>
  <Teleport to="body">
    <div class="p-toast-host" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="p-toast-slide">
        <div
          v-for="(toast, index) in toasts"
          :key="toast.id"
          class="p-toast"
          :class="`p-toast--${toast.type}`"
          :style="{ top: getToastTop(index) }"
          role="status"
          @mouseenter="pause(toast.id)"
          @mouseleave="resume(toast.id)"
          @click="dismiss(toast.id)"
        >
          <span class="p-toast-dot" aria-hidden="true" />
          <div class="p-toast-content">
            <strong v-if="toast.title" class="p-toast-title">{{ toast.title }}</strong>
            <span class="p-toast-message">{{ toast.message }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, pause, resume, dismiss } = useToast()

function getToastTop(index: number) {
  return `calc(var(--a-topbar-height, 56px) + max(1rem, env(safe-area-inset-top, 0px)) + ${index * 52}px)`
}
</script>

<style scoped>
.p-toast-host {
  pointer-events: none;
}

.p-toast {
  position: fixed;
  left: 50%;
  z-index: var(--a-z-toast, 900);
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px;
  max-width: 80vw;
  transform: translateX(-50%);
  border-radius: var(--a-radius-none, 4px);
  padding: 8px 14px;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  border: 1px solid var(--a-color-border);
  box-shadow: none !important;
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  transition: top var(--a-motion-state) var(--a-motion-ease-enter),
              opacity var(--a-motion-state) var(--a-motion-ease-enter),
              transform var(--a-motion-state) var(--a-motion-ease-enter);
}

.p-toast-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.p-toast--info .p-toast-dot {
  background-color: var(--a-color-muted);
}

.p-toast--success .p-toast-dot {
  background-color: var(--a-color-success);
}

.p-toast--warning .p-toast-dot {
  background-color: var(--a-color-warning);
}

.p-toast--danger .p-toast-dot,
.p-toast--error .p-toast-dot {
  background-color: var(--a-color-danger);
}

.p-toast-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.2;
}

.p-toast-title {
  font-weight: 500;
}

.p-toast-slide-enter-active,
.p-toast-slide-leave-active {
  transition: opacity var(--a-motion-state) var(--a-motion-ease-enter),
              transform var(--a-motion-state) var(--a-motion-ease-enter);
}

.p-toast-slide-enter-from,
.p-toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
