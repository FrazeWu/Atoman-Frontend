<template>
  <Teleport to="body" :disabled="isTestEnv">
    <button
      v-if="activeTheme?.is_enabled"
      type="button"
      class="theme-escape-hatch"
      :title="isEscapeHatchActive ? '恢复作者样式' : '切换为默认排版'"
      :aria-pressed="isEscapeHatchActive"
      @click="toggleEscapeHatch"
    >
      <span
        class="escape-hatch-dot"
        :class="{ 'is-active': isEscapeHatchActive }"
      />
      <span>{{ isEscapeHatchActive ? '作者样式' : '默认排版' }}</span>
    </button>
  </Teleport>
</template>

<script setup lang="ts">
import { useCreatorTheme } from '@/composables/useCreatorTheme'

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))
const { activeTheme, isEscapeHatchActive, toggleEscapeHatch } = useCreatorTheme()
</script>

<style scoped>
.theme-escape-hatch {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  z-index: var(--a-layer-normal-sheet-panel, 310);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background-color: var(--a-color-surface);
  color: var(--a-color-text);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  outline: none;
}

.theme-escape-hatch:hover {
  transform: scale(1.05);
  background-color: var(--a-color-surface-muted);
  border-color: var(--a-color-border);
}

.theme-escape-hatch:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.escape-hatch-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: var(--a-color-muted);
}

.escape-hatch-dot.is-active {
  background-color: var(--a-color-primary);
}
</style>
