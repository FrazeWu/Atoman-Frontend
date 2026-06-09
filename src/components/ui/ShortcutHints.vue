<template>
  <div class="shortcut-info-wrap">
    <div class="shortcut-trigger">
      <NIcon size="18"><HelpCircleOutline /></NIcon>
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
import { NIcon } from 'naive-ui'
import { HelpCircleOutline } from '@vicons/ionicons5'

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
  background: #fff;
  border: 1.5px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  border-radius: 4px;
  transition: all 0.2s;
}
.shortcut-trigger:hover {
  background: #000;
  color: #fff;
}
.shortcut-content {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 1rem;
  background: #fff;
  border: 1.5px solid #000;
  padding: 1.25rem;
  width: 14rem;
  box-shadow: 10px 10px 0 rgba(0,0,0,0.1);
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px);
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.shortcut-info-wrap:hover .shortcut-content {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.shortcut-header {
  font-family: var(--a-font-meta);
  font-weight: 900;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  border-bottom: 1.5px solid #eee;
  padding-bottom: 0.5rem;
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
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 500;
}
.shortcut-item kbd {
  font-family: var(--a-font-mono);
  background: #eee;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  border: 1px solid #ddd;
  min-width: 1.2rem;
  text-align: center;
}
</style>
