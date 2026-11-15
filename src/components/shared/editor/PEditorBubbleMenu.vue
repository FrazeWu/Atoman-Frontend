<template>
  <div
    class="p-editor-bubble-menu"
    :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    role="toolbar"
    aria-label="快速文本格式"
  >
    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="粗体"
      aria-label="粗体"
      @mousedown.prevent="$emit('command', 'bold')"
    >
      <Bold :size="15" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="斜体"
      aria-label="斜体"
      @mousedown.prevent="$emit('command', 'italic')"
    >
      <Italic :size="15" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="删除线"
      aria-label="删除线"
      @mousedown.prevent="$emit('command', 'strike')"
    >
      <Strikethrough :size="15" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="行内代码"
      aria-label="行内代码"
      @mousedown.prevent="$emit('command', 'inlineCode')"
    >
      <Code :size="15" aria-hidden="true" />
    </button>

    <div class="p-editor-bubble-menu__divider" aria-hidden="true" />

    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="链接"
      aria-label="链接"
      @mousedown.prevent="$emit('command', 'link')"
    >
      <Link :size="15" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="引用"
      aria-label="引用"
      @mousedown.prevent="$emit('command', 'blockquote')"
    >
      <Quote :size="15" aria-hidden="true" />
    </button>

    <div class="p-editor-bubble-menu__divider" aria-hidden="true" />

    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="二级标题"
      aria-label="二级标题"
      @mousedown.prevent="$emit('command', 'heading2')"
    >
      <Heading2 :size="15" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="p-editor-bubble-menu__btn"
      title="三级标题"
      aria-label="三级标题"
      @mousedown.prevent="$emit('command', 'heading3')"
    >
      <Heading3 :size="15" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Quote,
  Heading2,
  Heading3,
} from 'lucide-vue-next'
import type { PostEditorCommand } from '@/components/blog/postEditorCommands'

defineProps<{
  position: { top: number; left: number }
}>()

defineEmits<{
  command: [cmd: PostEditorCommand]
}>()
</script>

<style scoped>
.p-editor-bubble-menu {
  position: fixed;
  z-index: 45;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 6px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-pill, 9999px);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(12px);
  user-select: none;
  animation: bubble-pop-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes bubble-pop-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.p-editor-bubble-menu__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--a-radius-control, 6px);
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.p-editor-bubble-menu__btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.p-editor-bubble-menu__btn:active {
  transform: scale(0.92);
}

.p-editor-bubble-menu__divider {
  width: 1px;
  height: 14px;
  background: var(--a-color-border-soft);
  margin: 0 3px;
}
</style>
