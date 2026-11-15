<template>
  <div v-if="show" class="outline-wrapper">
    <!-- 移动端半透明遮罩 -->
    <div class="outline-backdrop" @click="emit('close')" />

    <div
      class="editor-outline-panel a-card-sm"
      role="region"
      aria-label="文章大纲目录"
    >
      <div class="outline-header">
        <div class="outline-title-wrap">
          <ListTree :size="15" class="outline-title-icon" aria-hidden="true" />
          <span class="outline-title">文章大纲</span>
          <span v-if="headings.length" class="outline-count-badge">
            {{ headings.length }}
          </span>
        </div>
        <button
          type="button"
          class="outline-close-btn"
          aria-label="关闭大纲"
          title="关闭大纲"
          @click="emit('close')"
        >
          <X :size="16" aria-hidden="true" />
        </button>
      </div>

      <div class="outline-body a-code-scroll">
        <div v-if="headings.length === 0" class="outline-empty a-muted">
          <ListTree :size="24" class="outline-empty-icon" aria-hidden="true" />
          <p>暂无标题结构</p>
          <span>在正文输入 # 一级标题、## 二级标题 即可自动生成目录导航</span>
        </div>

        <ul v-else class="outline-list" role="list">
          <li
            v-for="item in headings"
            :key="item.id"
            class="outline-item"
            :class="[
              `outline-item--h${item.level}`,
              { 'is-active': activeLine === item.lineNumber },
            ]"
          >
            <button
              type="button"
              class="outline-item-btn"
              :title="`第 ${item.lineNumber} 行：${item.text}`"
              @click="handleSelect(item.lineNumber)"
            >
              <span class="outline-item-tag">H{{ item.level }}</span>
              <span class="outline-item-text">{{ item.text }}</span>
              <span class="outline-item-line">L{{ item.lineNumber }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ListTree, X } from 'lucide-vue-next'
import type { PostOutlineHeading } from '@/composables/blog/usePostEditorOutline'

defineProps<{
  show: boolean
  headings: PostOutlineHeading[]
  activeLine: number | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-heading', lineNumber: number): void
}>()

const handleSelect = (lineNumber: number) => {
  emit('select-heading', lineNumber)
  if (typeof window !== 'undefined' && window.innerWidth <= 640) {
    emit('close')
  }
}
</script>

<style scoped>
.outline-wrapper {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 35;
}

.outline-backdrop {
  display: none;
}

.editor-outline-panel {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 280px;
  max-height: calc(100% - 1.5rem);
  display: flex;
  flex-direction: column;
  background: var(--a-color-bg, #ffffff);
  border: var(--a-border);
  border-radius: var(--a-radius-card, 4px);
  box-shadow: var(--a-shadow-card, none);
  pointer-events: auto;
  overflow: hidden;
  z-index: 36;
}

.outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: var(--a-color-surface, #f8fafc);
  flex-shrink: 0;
}

.outline-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.outline-title-icon {
  color: var(--a-color-primary, #2563eb);
}

.outline-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--a-color-fg, #0f172a);
}

.outline-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  border-radius: var(--a-radius-pill, 9999px);
  background: var(--a-color-surface-hover, #e2e8f0);
  color: var(--a-color-muted, #64748b);
  font-size: 0.7rem;
  font-weight: 600;
}

.outline-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted, #64748b);
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: color 0.12s ease, background-color 0.12s ease;
}

.outline-close-btn:hover {
  color: var(--a-color-fg, #0f172a);
  background: var(--a-color-surface-hover, #e2e8f0);
}

.outline-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0.25rem;
  min-height: 0;
}

.outline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.4rem;
  padding: 2rem 1rem;
}

.outline-empty-icon {
  opacity: 0.5;
  margin-bottom: 0.2rem;
}

.outline-empty p {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 500;
}

.outline-empty span {
  font-size: 0.75rem;
  line-height: 1.45;
}

.outline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.outline-item {
  position: relative;
  border-radius: var(--a-radius-control, 4px);
  transition: background-color 0.12s ease;
}

.outline-item-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: none;
  background: transparent;
  color: var(--a-color-fg, #0f172a);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  border-radius: var(--a-radius-control, 4px);
  text-align: left;
  transition: color 0.12s ease, background-color 0.12s ease;
}

.outline-item-btn:hover {
  background: var(--a-color-surface-hover, rgba(0, 0, 0, 0.04));
}

.outline-item.is-active .outline-item-btn {
  background: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-primary, #2563eb);
  font-weight: 600;
}

.outline-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.25rem;
  bottom: 0.25rem;
  width: 3px;
  background: var(--a-color-primary, #2563eb);
  border-radius: 2px;
}

/* 标题层级缩进 */
.outline-item--h1 .outline-item-btn {
  padding-left: 0.6rem;
}

.outline-item--h2 .outline-item-btn {
  padding-left: 1.25rem;
}

.outline-item--h3 .outline-item-btn {
  padding-left: 1.9rem;
}

.outline-item--h4 .outline-item-btn {
  padding-left: 2.5rem;
}

.outline-item-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.15rem;
  font-size: 0.65rem;
  font-weight: 600;
  border-radius: 3px;
  background: var(--a-color-surface-hover, #e2e8f0);
  color: var(--a-color-muted, #64748b);
  flex-shrink: 0;
}

.outline-item.is-active .outline-item-tag {
  background: var(--a-color-primary, #2563eb);
  color: #ffffff;
}

.outline-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-item-line {
  font-size: 0.7rem;
  color: var(--a-color-muted, #64748b);
  font-family: var(--a-font-mono, monospace);
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .outline-wrapper {
    position: fixed;
    z-index: 90;
  }

  .outline-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    pointer-events: auto;
  }

  .editor-outline-panel {
    position: absolute;
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 60vh;
    border-radius: var(--a-radius-card, 4px) var(--a-radius-card, 4px) 0 0;
    border-inline: none;
    border-bottom: none;
  }
}
</style>
