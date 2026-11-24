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
              aria-label="目录与检索"
              ><span>目录</span><span class="book-reader-shell__tool-detail">与检索</span></button>
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

      <div v-else-if="hasTools" class="book-reader-shell__offscreen-slots" aria-hidden="true" style="display: none;">
        <slot name="settings" />
        <slot name="tools" />
      </div>
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
const initialViewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
const desktopLayout = initialViewportWidth > 640
// On narrower desktops the tools remain one click away without hiding the book.
const roomyLayout = initialViewportWidth >= 1120
const activePanel = ref<'tools' | 'settings' | ''>(
  props.initialPanel ?? (roomyLayout ? (slots.settings ? 'settings' : (props.toc.length || slots.tools ? 'tools' : '')) : ''),
)
const hasTools = computed(() => Boolean(props.toc.length || slots.tools || slots.settings))

const showSidebar = ref(desktopLayout && initialViewportWidth >= 960)
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  width: 100%;
  max-width: 100%;
  flex: 1;
  background: var(--book-reader-canvas, #ebeef2);
  border: 0 !important;
  border-radius: 0;
  overflow: hidden;
  box-shadow: none !important;
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.25rem;
  padding: 0.35rem 0.85rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.04));
  background: var(--book-reader-surface, #ffffff);
}

.book-reader-shell__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--book-reader-muted, var(--a-color-muted));
  transition: color 0.15s ease, background-color 0.15s ease;
}

.book-reader-shell__back:hover {
  background-color: rgba(0, 0, 0, 0.06);
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
  min-height: 1.3rem;
  padding: 0 0.4rem;
  border: 0;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.68rem;
  font-weight: 600;
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
  gap: 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  flex: 1;
  overflow: hidden;
}

.book-reader-shell__reading-column {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  flex: 1;
  overflow: hidden;
  background: var(--book-reader-canvas, #ebeef2);
}

.book-reader-shell__toolbar {
  position: relative;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.25rem 0.75rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.04));
  border-radius: 0;
  background: var(--book-reader-surface, #f8f9fa);
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.85rem;
  overflow-x: auto;
}

.book-reader-shell__sidebar-wrapper {
  flex-shrink: 0;
  display: flex;
  background: var(--book-reader-surface, #f7f8fa);
  border-right: 0;
}

.book-reader-shell__toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.book-reader-shell__toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.book-reader-shell__tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--book-reader-muted, var(--a-color-muted));
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.book-reader-shell__tool-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-shell__tool-btn.is-active {
  background: color-mix(in srgb, var(--a-color-primary, #007aff) 12%, transparent);
  color: var(--a-color-primary, #007aff);
}

.book-reader-shell__zoom-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.35rem;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: rgba(0, 0, 0, 0.05);
}

.book-reader-shell__zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--book-reader-muted, var(--a-color-muted));
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.book-reader-shell__zoom-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
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
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--book-reader-text, var(--a-color-fg));
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
}

.book-reader-shell__pagination button:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
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
  min-height: 2rem;
  padding: 0.35rem 0.85rem;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--book-reader-muted, var(--a-color-muted));
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
}

.book-reader-shell__panel-tabs button[aria-pressed="true"] {
  background: rgba(0, 0, 0, 0.08);
  color: var(--book-reader-text, var(--a-color-fg));
  font-weight: 600;
}

.book-reader-shell__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  flex: 1;
  overflow: hidden;
  border: 0;
  background: var(--book-reader-canvas, #ebeef2);
  box-shadow: none;
}

.book-reader-shell__progress {
  display: grid;
  gap: 0.35rem;
  padding: 0.45rem 1rem 0.65rem;
  border: 0;
  border-radius: 0;
  background: var(--book-reader-canvas, #ebeef2);
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.75rem;
}

.book-reader-shell__progress-track {
  height: 3px;
  overflow: hidden;
  border-radius: var(--a-radius-control, 4px);
  background: color-mix(in srgb, var(--book-reader-text, #1c1c1e) 10%, transparent);
}

.book-reader-shell__progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--a-color-primary, #007aff);
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
  flex-shrink: 0;
  width: 18rem;
  max-width: 320px;
  height: 100%;
  max-height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.85rem;
  overflow: auto;
  padding: 1rem 1.25rem;
  border: 0;
  border-left: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.08));
  background: var(--book-reader-surface, var(--a-color-bg));
  box-shadow: none;
  color: var(--book-reader-text, var(--a-color-fg));
  box-sizing: border-box;
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
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: 100%;
    max-height: min(50vh, 28rem);
    padding: 0.85rem;
    z-index: 50;
    border-top: 1px solid var(--a-color-border-soft, rgba(0, 0, 0, 0.12));
    border-left: 0;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
  }

  .book-reader-shell__toolbar-right {
    gap: 0.35rem;
    min-width: 0;
  }

  .book-reader-shell__panel-tabs {
    width: auto;
    gap: 0.15rem;
  }

  .book-reader-shell__panel-tabs button {
    flex: none;
    white-space: nowrap;
    padding-inline: 0.4rem;
  }

  .book-reader-shell__tool-detail {
    display: none;
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
