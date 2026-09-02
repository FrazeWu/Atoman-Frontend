<template>
  <div class="post-format-toolbar" role="toolbar" aria-label="文章格式">
    <button
      v-for="tool in tools"
      :key="tool.command"
      type="button"
      class="post-format-toolbar__button"
      :class="{ 'is-active': activeCommands.includes(tool.command) }"
      :disabled="readonly"
      :aria-label="tool.label"
      :title="tool.label"
      @click="$emit('command', tool.command)"
    >
      <component v-if="tool.icon" :is="tool.icon" :size="15" aria-hidden="true" />
      <span v-else>{{ tool.text }}</span>
    </button>

    <span class="post-format-toolbar__separator" aria-hidden="true" />
    <button
      type="button"
      class="post-format-toolbar__button"
      :class="{ 'is-active': lineNumbers }"
      :aria-pressed="lineNumbers"
      aria-label="显示行号"
      title="显示行号"
      @click="$emit('update:line-numbers', !lineNumbers)"
    >
      <Hash :size="15" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { IconAt as AtSign, IconBold as Bold, IconBook2 as BookOpen, IconCode as Code2, IconHeadphones as Headphones, IconHash as Hash, IconPhoto as Image, IconItalic as Italic, IconLink as Link, IconList as List, IconListNumbers as ListOrdered, IconMinus as Minus, IconQuote as Quote, IconArrowForwardUp as Redo2, IconSum as Sigma, IconStrikethrough as Strikethrough, IconTable as Table, IconArrowBackUp as Undo2, IconVideo as Video, type Icon as LucideIcon } from '@tabler/icons-vue'

import type { PostEditorCommand } from './postEditorCommands'

withDefaults(defineProps<{
  activeCommands?: PostEditorCommand[]
  lineNumbers: boolean
  readonly?: boolean
}>(), {
  activeCommands: () => [],
  readonly: false,
})

defineEmits<{
  (e: 'command', command: PostEditorCommand): void
  (e: 'update:line-numbers', value: boolean): void
}>()

type Tool = {
  command: PostEditorCommand
  label: string
  text?: string
  icon?: LucideIcon
}

const tools: Tool[] = [
  { command: 'undo', label: '撤销', icon: Undo2 },
  { command: 'redo', label: '重做', icon: Redo2 },
  { command: 'heading2', label: '二级标题', text: 'H2' },
  { command: 'heading3', label: '三级标题', text: 'H3' },
  { command: 'heading4', label: '四级标题', text: 'H4' },
  { command: 'bold', label: '粗体', icon: Bold },
  { command: 'italic', label: '斜体', icon: Italic },
  { command: 'strike', label: '删除线', icon: Strikethrough },
  { command: 'blockquote', label: '引用', icon: Quote },
  { command: 'bulletList', label: '无序列表', icon: List },
  { command: 'orderedList', label: '有序列表', icon: ListOrdered },
  { command: 'link', label: '链接', icon: Link },
  { command: 'image', label: '图片', icon: Image },
  { command: 'table', label: '表格', icon: Table },
  { command: 'codeBlock', label: '代码块', icon: Code2 },
  { command: 'horizontalRule', label: '分割线', icon: Minus },
  { command: 'math', label: '数学公式', icon: Sigma },
  { command: 'postEmbed', label: '文章嵌入', icon: BookOpen },
  { command: 'musicEmbed', label: '音乐嵌入', icon: Headphones },
  { command: 'videoEmbed', label: '视频嵌入', icon: Video },
  { command: 'reference', label: '添加引用', icon: AtSign },
]
</script>

<style scoped>
.post-format-toolbar {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  align-content: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  overflow: visible;
  padding: 0.35rem 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  scrollbar-width: thin;
}

.post-format-toolbar__button {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  place-items: center;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
}

.post-format-toolbar__button:hover:not(:disabled),
.post-format-toolbar__button.is-active {
  border-color: var(--a-color-fg);
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.post-format-toolbar__button:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.post-format-toolbar__button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.post-format-toolbar__separator {
  width: 1px;
  height: 1.25rem;
  flex: 0 0 1px;
  margin-inline: 0.1rem;
  background: var(--a-color-border-soft);
}

@media (max-width: 960px) {
  .post-format-toolbar {
    min-height: 3.25rem;
    padding-inline: 0.5rem;
  }

  .post-format-toolbar__button {
    width: 2.75rem;
    height: 2.75rem;
    flex-basis: 2.75rem;
  }
}
</style>
