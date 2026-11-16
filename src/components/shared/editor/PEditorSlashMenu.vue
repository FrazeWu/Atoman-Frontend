<template>
  <div
    ref="menuRef"
    class="p-editor-slash-menu"
    :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    role="listbox"
    aria-label="快捷插入菜单"
  >
    <div v-if="items.length === 0" class="p-editor-slash-menu__empty" role="status">
      无匹配命令
    </div>
    <div v-else class="p-editor-slash-menu__list">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        :ref="(el) => setItemRef(el, index)"
        type="button"
        role="option"
        :aria-selected="index === activeIndex"
        class="p-editor-slash-menu__item"
        :class="{ 'is-active': index === activeIndex }"
        @mouseenter="$emit('hover', index)"
        @mousedown.prevent="$emit('select', item)"
      >
        <div class="p-editor-slash-menu__icon-box">
          <component :is="item.icon" :size="15" aria-hidden="true" />
        </div>
        <span class="p-editor-slash-menu__label">{{ item.label }}</span>
        <span v-if="item.hint" class="p-editor-slash-menu__hint">{{ item.hint }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, type ComponentPublicInstance } from 'vue'
import type { SlashMenuItem } from './slashCommands'

const props = defineProps<{
  items: SlashMenuItem[]
  activeIndex: number
  position: { top: number; left: number }
}>()

defineEmits<{
  select: [item: SlashMenuItem]
  hover: [index: number]
}>()

const menuRef = ref<HTMLElement | null>(null)
const itemElements = new Map<number, HTMLElement>()

function setItemRef(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof HTMLElement) {
    itemElements.set(index, el)
  } else {
    itemElements.delete(index)
  }
}

watch(
  () => props.activeIndex,
  async (newIndex) => {
    await nextTick()
    const target = itemElements.get(newIndex)
    if (target && menuRef.value) {
      target.scrollIntoView({ block: 'nearest' })
    }
  },
)
</script>

<style scoped>
.p-editor-slash-menu {
  position: fixed;
  z-index: 50;
  width: min(260px, calc(100vw - 24px));
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 10px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06);
  user-select: none;
  animation: slash-pop-in 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slash-pop-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.p-editor-slash-menu__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.p-editor-slash-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--a-radius-control, 6px);
  background: transparent;
  color: var(--a-color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.p-editor-slash-menu__item:hover,
.p-editor-slash-menu__item.is-active {
  background: var(--a-color-surface-muted);
}

.p-editor-slash-menu__icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--a-radius-control, 6px);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
  flex-shrink: 0;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.p-editor-slash-menu__item.is-active .p-editor-slash-menu__icon-box {
  background: var(--a-color-primary);
  color: #fff;
}

.p-editor-slash-menu__label {
  flex: 1;
  min-width: 0;
  font-size: var(--a-text-sm, 13px);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-editor-slash-menu__hint {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--a-color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 5px;
  border-radius: 4px;
  flex-shrink: 0;
}

.p-editor-slash-menu__empty {
  padding: 16px 12px;
  text-align: center;
  font-size: var(--a-text-sm, 13px);
  color: var(--a-color-text-secondary);
}
</style>
