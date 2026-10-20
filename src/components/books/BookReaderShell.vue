<template>
  <section class="book-reader-shell" :aria-label="ariaLabel">
    <header class="book-reader-shell__header">
      <RouterLink class="book-reader-shell__back" :to="backTo" :aria-label="backLabel" :title="backLabel">
        <ArrowLeft :size="18" aria-hidden="true" />
      </RouterLink>
      <div class="book-reader-shell__heading">
        <div class="book-reader-shell__title-row">
          <h2>{{ title }}</h2>
          <span v-if="format" class="book-reader-shell__format">{{ format.toUpperCase() }}</span>
        </div>
        <p v-if="subtitle || $slots.subtitle">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="book-reader-shell__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot name="status" />

    <section v-if="showSurface" class="book-reader-shell__workspace">
      <!-- 左侧边栏：导览面板 (PDF Expert 风格) -->
      <div v-if="showSidebar && ($slots.sidebar || $slots.thumbnails)" class="book-reader-shell__sidebar-wrapper">
        <slot name="sidebar">
          <slot name="thumbnails" />
        </slot>
      </div>

      <div class="book-reader-shell__reading-column">
        <div class="book-reader-shell__toolbar">
          <div class="book-reader-shell__toolbar-left">
            <button
              v-if="$slots.sidebar || $slots.thumbnails"
              type="button"
              class="book-reader-shell__tool-btn"
              :class="{ 'is-active': showSidebar }"
              :aria-pressed="showSidebar"
              title="切换导览侧栏"
              aria-label="切换导览侧栏"
              @click="showSidebar = !showSidebar"
            >
              <LayoutSidebar :size="16" aria-hidden="true" />
            </button>
            <span v-if="toolbarLabel" class="book-reader-shell__toolbar-label">{{ toolbarLabel }}</span>
          </div>

          <div v-if="pageLabel || showPagination" class="book-reader-shell__pagination tabular-nums">
            <button v-if="showPagination" type="button" aria-label="上一页" title="上一页" :disabled="!canPrev" @click="emit('previous')">
              <ChevronLeft :size="18" aria-hidden="true" />
            </button>
            <span>{{ pageLabel || format.toUpperCase() }}</span>
            <button v-if="showPagination" type="button" aria-label="下一页" title="下一页" :disabled="!canNext" @click="emit('next')">
              <ChevronRight :size="18" aria-hidden="true" />
            </button>
          </div>

          <div class="book-reader-shell__toolbar-right">
            <!-- 翻页 / 连续滚动切换 (PDF Expert 风格) -->
            <button
              v-if="showScrollModeToggle"
              type="button"
              class="book-reader-shell__tool-btn"
              :class="{ 'is-active': scrollMode === 'continuous' }"
              :title="scrollMode === 'continuous' ? '当前：连续滚动（点击切换单页翻页）' : '当前：单页翻页（点击切换连续滚动）'"
              :aria-label="scrollMode === 'continuous' ? '切换为单页翻页' : '切换为连续滚动'"
              @click="toggleScrollMode"
            >
              <ArrowsDownUp v-if="scrollMode === 'continuous'" :size="16" aria-hidden="true" />
              <FileDescription v-else :size="16" aria-hidden="true" />
            </button>

            <!-- 缩放控制 (PDF Expert 风格) -->
            <div v-if="showZoom" class="book-reader-shell__zoom-controls tabular-nums" role="group" aria-label="页面缩放">
              <button
                type="button"
                class="book-reader-shell__zoom-btn"
                aria-label="缩小"
                title="缩小"
                :disabled="zoom <= minZoom"
                @click="changeZoom(-10)"
              >
                <ZoomOut :size="15" aria-hidden="true" />
              </button>
              <span class="book-reader-shell__zoom-value">{{ zoom }}%</span>
              <button
                type="button"
                class="book-reader-shell__zoom-btn"
                aria-label="放大"
                title="放大"
                :disabled="zoom >= maxZoom"
                @click="changeZoom(10)"
              >
                <ZoomIn :size="15" aria-hidden="true" />
              </button>
            </div>

            <nav v-if="hasTools" class="book-reader-shell__panel-tabs" aria-label="阅读工具">
              <button
                v-if="toc.length || $slots.tools"
                type="button"
                :aria-pressed="activePanel === 'tools'"
                @click="togglePanel('tools')"
              >目录与检索</button>
              <button
                v-if="$slots.settings"
                type="button"
                :aria-pressed="activePanel === 'settings'"
                @click="togglePanel('settings')"
              >显示设置</button>
            </nav>
          </div>
        </div>

        <div class="book-reader-shell__content">
          <slot />
        </div>

        <footer class="book-reader-shell__progress" aria-label="阅读进度">
          <div class="book-reader-shell__progress-track" aria-hidden="true"><span :style="{ width: `${progressPercent}%` }" /></div>
          <div class="book-reader-shell__progress-labels">
            <span>阅读进度</span>
            <strong class="tabular-nums">{{ progressPercent }}%</strong>
          </div>
        </footer>
      </div>

      <aside v-if="hasTools && activePanel" class="book-reader-shell__panel" :aria-label="activePanel === 'settings' ? '显示设置' : '目录与工具'">
        <div class="book-reader-shell__panel-heading">
          <h3>{{ activePanel === 'settings' ? '显示设置' : '目录与工具' }}</h3>
          <button type="button" aria-label="关闭阅读工具" @click="activePanel = ''">×</button>
        </div>
        <div v-show="activePanel === 'settings'" class="book-reader-shell__panel-body">
          <slot name="settings" />
        </div>
        <div v-show="activePanel === 'tools'" class="book-reader-shell__panel-body">
          <section v-if="toc.length" class="book-reader-shell__toc" aria-label="目录">
            <h4>目录</h4>
            <ol>
              <li v-for="(item, index) in toc" :key="item.id || `${item.href}-${index}`">
                <button type="button" :class="{ 'is-nested': (item.depth || 0) > 0 }" @click="emit('toc-select', item.href)">
                  {{ item.label }}
                </button>
              </li>
            </ol>
          </section>
          <slot name="tools" />
        </div>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import {
  ArrowLeft,
  ArrowUpDown as ArrowsDownUp,
  ChevronLeft,
  ChevronRight,
  FileText as FileDescription,
  PanelLeft as LayoutSidebar,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
import type { BookReaderScrollMode } from '@/utils/bookReaderPreferences'

export type BookReaderTocItem = {
  id?: string
  href: string
  label: string
  depth?: number
}

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  format?: string
  progress?: number
  pageLabel?: string
  toolbarLabel?: string
  backTo: string
  backLabel: string
  ariaLabel?: string
  canPrev?: boolean
  canNext?: boolean
  showPagination?: boolean
  showSurface?: boolean
  toc?: BookReaderTocItem[]
  showZoom?: boolean
  initialZoom?: number
  minZoom?: number
  maxZoom?: number
  showScrollModeToggle?: boolean
  initialScrollMode?: BookReaderScrollMode
  initialPanel?: 'tools' | 'settings' | ''
}>(), {
  subtitle: '',
  format: '',
  progress: 0,
  pageLabel: '',
  toolbarLabel: '',
  ariaLabel: '电子书阅读器',
  canPrev: true,
  canNext: true,
  showPagination: false,
  showSurface: true,
  toc: () => [],
  showZoom: false,
  initialZoom: 100,
  minZoom: 50,
  maxZoom: 200,
  showScrollModeToggle: false,
  initialScrollMode: 'paginated',
})

const emit = defineEmits<{
  previous: []
  next: []
  'toc-select': [href: string]
  'zoom-change': [zoom: number]
  'scroll-mode-change': [mode: BookReaderScrollMode]
}>()

const progressPercent = computed(() => Math.round(Math.max(0, Math.min(1, props.progress)) * 100))
const slots = useSlots()
const desktopLayout = typeof window === 'undefined' || window.innerWidth > 640
const activePanel = ref<'tools' | 'settings' | ''>(
  props.initialPanel ?? (slots.settings && desktopLayout ? 'settings' : (props.toc.length || slots.tools ? 'tools' : '')),
)
const hasTools = computed(() => Boolean(props.toc.length || slots.tools || slots.settings))

const showSidebar = ref(desktopLayout)
const zoom = ref(props.initialZoom)
const scrollMode = ref<BookReaderScrollMode>(props.initialScrollMode)

watch(() => props.initialScrollMode, (val) => {
  if (val) scrollMode.value = val
})

function toggleScrollMode() {
  const nextMode: BookReaderScrollMode = scrollMode.value === 'continuous' ? 'paginated' : 'continuous'
  scrollMode.value = nextMode
  emit('scroll-mode-change', nextMode)
}

function changeZoom(delta: number) {
  const newZoom = Math.max(props.minZoom, Math.min(props.maxZoom, zoom.value + delta))
  if (newZoom !== zoom.value) {
    zoom.value = newZoom
    emit('zoom-change', newZoom)
  }
}

function togglePanel(panel: 'tools' | 'settings') {
  activePanel.value = activePanel.value === panel ? '' : panel
}
</script>

<style scoped>
.book-reader-shell {
  display: grid;
  gap: 1rem;
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.75rem;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--book-reader-surface, var(--a-color-bg));
}

.book-reader-shell__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--book-reader-muted, var(--a-color-muted));
  transition: color 0.15s ease, background-color 0.15s ease;
}

.book-reader-shell__back:hover {
  background-color: color-mix(in srgb, var(--book-reader-surface, var(--a-color-bg)) 88%, var(--book-reader-text, var(--a-color-fg)));
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__back:focus-visible,
.book-reader-shell__pagination button:focus-visible,
.book-reader-shell__toc button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.book-reader-shell__heading {
  min-width: 0;
}

.book-reader-shell__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.book-reader-shell__title-row h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  line-height: 1.35;
}

.book-reader-shell__format {
  display: inline-flex;
  align-items: center;
  min-height: 1.4rem;
  padding: 0 0.45rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.book-reader-shell__heading p,
.book-reader-shell :deep(.book-reader-shell__feedback) {
  margin: 0.25rem 0 0;
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.88rem;
}

.book-reader-shell__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-reader-shell__workspace {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  min-width: 0;
}

.book-reader-shell__reading-column {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  flex: 1;
}

.book-reader-shell__toolbar {
  position: sticky;
  top: var(--a-topbar-height, 3.5rem);
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  min-height: 3.25rem;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  border-bottom: 0;
  border-radius: var(--a-radius-card) var(--a-radius-card) 0 0;
  background: var(--book-reader-surface, var(--a-color-bg));
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.85rem;
}

.book-reader-shell__sidebar-wrapper {
  flex-shrink: 0;
  display: flex;
}

.book-reader-shell__toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.book-reader-shell__toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.book-reader-shell__tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface, var(--a-color-bg));
  color: var(--book-reader-muted, var(--a-color-muted));
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.book-reader-shell__tool-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__tool-btn.is-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
}

.book-reader-shell__zoom-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface, var(--a-color-bg));
}

.book-reader-shell__zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--book-reader-muted, var(--a-color-muted));
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.book-reader-shell__zoom-btn:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__zoom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.book-reader-shell__zoom-value {
  padding: 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--book-reader-text, var(--a-color-fg));
  min-width: 2.75rem;
  text-align: center;
}

.book-reader-shell__toolbar-label {
  margin-right: auto;
}

.book-reader-shell__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-variant-numeric: tabular-nums;
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__pagination button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface, var(--a-color-bg));
  color: var(--book-reader-text, var(--a-color-fg));
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
}

.book-reader-shell__pagination button:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--book-reader-surface, var(--a-color-bg)) 86%, var(--book-reader-text, var(--a-color-fg)));
}

.book-reader-shell__pagination button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.book-reader-shell__panel-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.book-reader-shell__panel-tabs button,
.book-reader-shell__panel-heading button {
  min-height: 2.5rem;
  padding: 0.4rem 0.65rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--book-reader-muted, var(--a-color-muted));
  cursor: pointer;
  font: inherit;
}

.book-reader-shell__panel-tabs button[aria-pressed="true"] {
  border-color: var(--a-color-border-soft);
  background: var(--book-reader-surface, var(--a-color-bg));
  color: var(--book-reader-text, var(--a-color-fg));
  font-weight: 600;
}

.book-reader-shell__content {
  display: grid;
  align-content: start;
  min-width: 0;
  min-height: min(68vh, 720px);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  background: var(--book-reader-surface, var(--a-color-bg));
  box-shadow: none;
}

.book-reader-shell__progress {
  display: grid;
  gap: 0.4rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--a-color-border-soft);
  border-top: 0;
  border-radius: 0 0 var(--a-radius-card) var(--a-radius-card);
  background: var(--book-reader-surface, var(--a-color-bg));
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.78rem;
}

.book-reader-shell__progress-track {
  height: 3px;
  overflow: hidden;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--book-reader-surface, var(--a-color-bg)) 80%, var(--book-reader-text, var(--a-color-fg)));
}

.book-reader-shell__progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--a-color-primary);
  transition: width 0.2s ease;
}

.book-reader-shell__progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.book-reader-shell__progress-labels strong {
  color: var(--book-reader-text, var(--a-color-fg));
  font-weight: 600;
}

.book-reader-shell__panel {
  position: sticky;
  top: calc(var(--a-topbar-height, 3.5rem) + 1rem);
  display: grid;
  gap: 0.85rem;
  min-width: 0;
  max-height: min(78vh, 56rem);
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--book-reader-surface, var(--a-color-bg));
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.book-reader-shell__panel-heading h3,
.book-reader-shell__toc h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.book-reader-shell__panel-heading button {
  width: 2.5rem;
  padding: 0;
  font-size: 1.3rem;
}

.book-reader-shell__panel-body {
  display: grid;
  align-content: start;
  gap: 1rem;
}

.book-reader-shell__panel-body :deep(.book-reader-display-controls) {
  display: grid;
  align-items: start;
  gap: 1rem;
  font-size: 0.9rem;
}

.book-reader-shell__panel-body :deep(.book-reader-display-controls label) {
  display: grid;
  align-items: start;
  gap: 0.5rem;
}

.book-reader-shell__panel-body :deep(.book-reader-display-controls select) {
  min-height: 2.5rem;
  padding-inline: 0.65rem;
}

.book-reader-shell__panel-body :deep(.book-reader-display-controls__themes) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.book-reader-shell__panel-body :deep(.book-reader-display-controls button) {
  min-height: 2.5rem;
}

.book-reader-shell__toc {
  display: grid;
  gap: 0.75rem;
}

.book-reader-shell__toc ol {
  display: grid;
  gap: 0.15rem;
  max-height: 40vh;
  margin: 0;
  padding: 0 0 0 1.2rem;
  overflow: auto;
}

.book-reader-shell__toc button {
  min-height: 2.25rem;
  padding: 0.25rem 0.35rem;
  border: 0;
  background: transparent;
  color: var(--book-reader-text, var(--a-color-fg));
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.book-reader-shell__toc button:hover {
  color: var(--a-color-primary);
}

.book-reader-shell__toc button.is-nested {
  padding-left: 1rem;
  color: var(--a-color-muted);
}

@media (max-width: 640px) {
  .book-reader-shell__workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .book-reader-shell__header {
    grid-template-columns: auto minmax(0, 1fr);
    padding-inline: 0.25rem;
  }

  .book-reader-shell__actions {
    grid-column: 2;
  }

  .book-reader-shell__toolbar {
    justify-content: space-between;
    padding: 0.4rem;
  }

  .book-reader-shell__panel {
    position: static;
    max-height: min(48vh, 28rem);
    padding: 0.85rem;
  }

  .book-reader-shell__panel-tabs {
    width: 100%;
  }

  .book-reader-shell__panel-tabs button {
    flex: 1;
  }

  .book-reader-shell__content {
    min-height: 62vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-reader-shell__back,
  .book-reader-shell__pagination button,
  .book-reader-shell__progress-track span {
    transition: none;
  }
}
</style>
