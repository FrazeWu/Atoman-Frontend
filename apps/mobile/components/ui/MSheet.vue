<template>
  <Teleport to="body" :disabled="!teleport || isTest">
    <div v-if="modelValue" class="m-sheet" role="dialog" aria-modal="true">
      <Transition name="m-sheet-fade" appear>
        <div class="m-sheet__backdrop" @click="handleClose" />
      </Transition>
      <Transition name="m-sheet-slide" appear>
        <div class="m-sheet__panel">
          <div class="m-sheet__handle-wrapper">
            <div class="m-sheet__handle" />
          </div>
          <header v-if="title || $slots.header" class="m-sheet__header">
            <slot name="header">
              <h2 class="m-sheet__title">{{ title }}</h2>
            </slot>
            <button
              type="button"
              class="m-sheet__close"
              aria-label="关闭"
              @click="handleClose"
            >
              <MIcon name="xmark" size="sm" />
            </button>
          </header>
          <div class="m-sheet__content">
            <slot />
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    teleport?: boolean
  }>(),
  {
    title: '',
    teleport: true,
  }
)

const emit = defineEmits<{
  'update:modelValue': [boolean]
  close: []
}>()

const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')

function handleClose() {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<style scoped>
.m-sheet {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.m-sheet__backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.4);
  -webkit-tap-highlight-color: transparent;
}

.m-sheet__panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 85vh;
  background-color: #ffffff;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 16px);
  overflow: hidden;
}

.m-sheet__handle-wrapper {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.m-sheet__handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background-color: var(--a-color-border, #cbd5e1);
}

.m-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.m-sheet__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.m-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--a-radius-control, 4px);
  border: none;
  background: transparent;
  color: var(--a-color-muted, #64748b);
  cursor: pointer;
  padding: 0;
}

.m-sheet__close:hover,
.m-sheet__close:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
  color: var(--a-color-text, #0f172a);
}

.m-sheet__content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
}

/* Animations */
.m-sheet-fade-enter-active,
.m-sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.m-sheet-fade-enter-from,
.m-sheet-fade-leave-to {
  opacity: 0;
}

.m-sheet-slide-enter-active,
.m-sheet-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.m-sheet-slide-enter-from,
.m-sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
