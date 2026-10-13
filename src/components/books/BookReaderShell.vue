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
      <div class="book-reader-shell__reading-column">
        <div class="book-reader-shell__toolbar">
          <span v-if="toolbarLabel" class="book-reader-shell__toolbar-label">{{ toolbarLabel }}</span>
          <div v-if="pageLabel || showPagination" class="book-reader-shell__pagination tabular-nums">
            <button v-if="showPagination" type="button" aria-label="上一页" title="上一页" :disabled="!canPrev" @click="emit('previous')">
              <ChevronLeft :size="18" aria-hidden="true" />
            </button>
            <span>{{ pageLabel || format.toUpperCase() }}</span>
            <button v-if="showPagination" type="button" aria-label="下一页" title="下一页" :disabled="!canNext" @click="emit('next')">
              <ChevronRight :size="18" aria-hidden="true" />
            </button>
          </div>
          <nav v-if="hasTools" class="book-reader-shell__panel-tabs" aria-label="阅读工具">
            <button
              v-if="toc.length || $slots.tools"
              type="button"
              :aria-pressed="activePanel === 'tools'"
              @click="togglePanel('tools')"
            >目录与工具</button>
            <button
              v-if="$slots.settings"
              type="button"
              :aria-pressed="activePanel === 'settings'"
              @click="togglePanel('settings')"
            >显示设置</button>
          </nav>
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
import { computed, ref, useSlots } from 'vue'
import { IconArrowLeft as ArrowLeft, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight } from '@tabler/icons-vue'

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
})

const emit = defineEmits<{
  previous: []
  next: []
  'toc-select': [href: string]
}>()

const progressPercent = computed(() => Math.round(Math.max(0, Math.min(1, props.progress)) * 100))
const slots = useSlots()
const desktopLayout = typeof window === 'undefined' || window.innerWidth > 640
const activePanel = ref<'tools' | 'settings' | ''>(
  slots.settings && desktopLayout ? 'settings' : (props.toc.length || slots.tools ? 'tools' : ''),
)
const hasTools = computed(() => Boolean(props.toc.length || slots.tools || slots.settings))

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
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: var(--book-reader-surface, #ffffff);
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
  background-color: color-mix(in srgb, var(--book-reader-surface, #ffffff) 88%, var(--book-reader-text, #111827));
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 999px;
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.7rem;
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(15rem, 18rem);
  align-items: start;
  gap: 1rem;
  min-width: 0;
}

.book-reader-shell__reading-column {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-bottom: 0;
  border-radius: var(--a-radius-card) var(--a-radius-card) 0 0;
  background: var(--book-reader-surface, #ffffff);
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.85rem;
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface, #ffffff);
  color: var(--book-reader-text, var(--a-color-fg));
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease;
}

.book-reader-shell__pagination button:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--book-reader-surface, #ffffff) 86%, var(--book-reader-text, #111827));
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
  border-color: var(--a-color-border-soft, #e2e8f0);
  background: var(--book-reader-surface, #ffffff);
  color: var(--book-reader-text, var(--a-color-fg));
  font-weight: 600;
}

.book-reader-shell__content {
  display: grid;
  align-content: start;
  min-width: 0;
  min-height: min(68vh, 720px);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: var(--book-reader-surface, #ffffff);
  box-shadow: 0 12px 36px rgb(15 23 42 / 5%);
}

.book-reader-shell__progress {
  display: grid;
  gap: 0.4rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-top: 0;
  border-radius: 0 0 var(--a-radius-card) var(--a-radius-card);
  background: var(--book-reader-surface, #ffffff);
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.78rem;
}

.book-reader-shell__progress-track {
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--book-reader-surface, #ffffff) 80%, var(--book-reader-text, #111827));
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card);
  background: var(--book-reader-surface, #ffffff);
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
