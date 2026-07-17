<template>
  <div class="shortcut-info-wrap">
    <div class="shortcut-trigger">
      <HelpCircle :size="18" />
    </div>
    <div class="shortcut-content">
      <div class="shortcut-header">键盘快捷键</div>
      <div class="shortcut-grid">
        <div v-for="hint in hints" :key="hint.key" class="shortcut-item">
          <kbd>{{ hint.key }}</kbd> <span>{{ hint.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { HelpCircle } from 'lucide-vue-next'

export interface ShortcutHint {
  key: string
  label: string
}

defineProps<{
  hints: ShortcutHint[]
}>()
</script>

<style scoped>
.shortcut-info-wrap {
  position: fixed;
  right: 2rem;
  bottom: 8rem;
  z-index: 100;
}
.shortcut-trigger {
  width: 2.5rem;
  height: 2.5rem;
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  border-radius: var(--a-radius-base);
  transition: all 0.2s ease;
}
.shortcut-trigger:hover {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
}
.shortcut-content {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 1rem;
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line);
  padding: 1.25rem;
  width: 14rem;
  box-shadow: none;
  border-radius: var(--a-radius-base);
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px);
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.shortcut-info-wrap:hover .shortcut-content,
.shortcut-info-wrap:focus-within .shortcut-content {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.shortcut-header {
  font-family: inherit;
  font-weight: var(--a-font-weight-strong, 700);
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  padding-bottom: 0.5rem;
  color: var(--a-color-fg);
}
.shortcut-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.shortcut-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-ink-muted);
}
.shortcut-item kbd {
  font-family: var(--a-font-meta);
  background: var(--a-color-paper-wash);
  padding: 0.1rem 0.35rem;
  border-radius: var(--a-radius-base);
  border: 1px solid var(--a-color-line-soft);
  min-width: 1.2rem;
  text-align: center;
  color: var(--a-color-fg);
}
</style>
