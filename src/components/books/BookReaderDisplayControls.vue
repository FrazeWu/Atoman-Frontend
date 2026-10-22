<template>
  <section class="book-reader-display-controls" aria-label="阅读显示偏好">
    <!-- 1. 字号 (保持第 1 个 select 以兼容单测契约) -->
    <label>
      <span>字号</span>
      <select :value="modelValue.font_scale" aria-label="字号" @change="setFontScale">
        <option :value="0.85">小</option>
        <option :value="1">标准</option>
        <option :value="1.15">大</option>
        <option :value="1.35">特大</option>
      </select>
    </label>

    <!-- 2. 字体选择 (Serif 宋体 / Sans 黑体 / Kaiti 楷体) -->
    <label>
      <span>字体</span>
      <select :value="modelValue.font_family || 'serif'" aria-label="排版字体" @change="setFontFamily">
        <option value="serif">宋体 / 典雅衬线</option>
        <option value="sans">黑体 / 现代无衬线</option>
        <option value="kaiti">楷体 / 传统文人</option>
      </select>
    </label>

    <!-- 3. 版式 -->
    <label v-if="showLayout">
      <span>版式</span>
      <select :value="modelValue.page_layout || 'single'" aria-label="页面排版" @change="setPageLayout">
        <option value="single">单页</option>
        <option value="double">双页对开</option>
      </select>
    </label>

    <!-- 4. 翻页模式 -->
    <label v-if="showScrollMode">
      <span>翻页</span>
      <select :value="modelValue.scroll_mode || 'paginated'" aria-label="翻页方式" @change="setScrollMode">
        <option value="paginated">单页翻页</option>
        <option value="continuous">连续滚动</option>
      </select>
    </label>

    <!-- 5. 四大护眼纸质主题 -->
    <div class="book-reader-display-controls__themes" role="group" aria-label="阅读主题">
      <button
        type="button"
        class="book-reader-display-controls__theme-btn is-paper"
        :class="{ 'is-active': modelValue.theme === 'paper' }"
        aria-label="纸张主题"
        title="纸白（高清晰度纯白纸张）"
        @click="setTheme('paper')"
      >
        纸
      </button>
      <button
        type="button"
        class="book-reader-display-controls__theme-btn is-sepia"
        :class="{ 'is-active': modelValue.theme === 'sepia' || modelValue.theme === 'dim' }"
        aria-label="羊皮纸主题"
        title="羊皮纸（温润暖色护眼）"
        @click="setTheme('sepia')"
      >
        羊
      </button>
      <button
        type="button"
        class="book-reader-display-controls__theme-btn is-slate"
        :class="{ 'is-active': modelValue.theme === 'slate' }"
        aria-label="雅灰主题"
        title="雅灰（低对比石墨质感）"
        @click="setTheme('slate')"
      >
        灰
      </button>
      <button
        type="button"
        class="book-reader-display-controls__theme-btn is-night"
        :class="{ 'is-active': modelValue.theme === 'night' }"
        aria-label="夜间主题"
        title="夜间（极黑背景护眼模式）"
        @click="setTheme('night')"
      >
        夜
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  BookReaderDisplayPreferences,
  BookReaderFontFamily,
  BookReaderPageLayout,
  BookReaderScrollMode,
  BookReaderTheme,
} from '@/utils/bookReaderPreferences'

const props = withDefaults(
  defineProps<{
    modelValue: BookReaderDisplayPreferences
    showLayout?: boolean
    showScrollMode?: boolean
  }>(),
  {
    showLayout: true,
    showScrollMode: true,
  }
)

const emit = defineEmits<{ 'update:modelValue': [value: BookReaderDisplayPreferences] }>()

function setFontScale(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('update:modelValue', { ...props.modelValue, font_scale: value })
}

function setFontFamily(event: Event) {
  const value = (event.target as HTMLSelectElement).value as BookReaderFontFamily
  emit('update:modelValue', { ...props.modelValue, font_family: value })
}

function setPageLayout(event: Event) {
  const value = (event.target as HTMLSelectElement).value as BookReaderPageLayout
  emit('update:modelValue', { ...props.modelValue, page_layout: value })
}

function setScrollMode(event: Event) {
  const value = (event.target as HTMLSelectElement).value as BookReaderScrollMode
  emit('update:modelValue', { ...props.modelValue, scroll_mode: value })
}

function setTheme(theme: BookReaderTheme) {
  emit('update:modelValue', { ...props.modelValue, theme })
}
</script>

<style scoped>
.book-reader-display-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--book-reader-muted, var(--a-color-muted));
  font-size: 0.82rem;
  user-select: none;
}

.book-reader-display-controls label,
.book-reader-display-controls__themes {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.book-reader-display-controls select,
.book-reader-display-controls button {
  min-height: 2rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  background: var(--book-reader-surface, var(--a-color-bg));
  color: var(--book-reader-text, var(--a-color-fg));
  box-shadow: none !important;
  font-family: inherit;
  font-size: 0.8125rem;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.book-reader-display-controls select {
  padding: 0 0.5rem;
}

.book-reader-display-controls button {
  min-width: 2rem;
  padding: 0 0.5rem;
  cursor: pointer;
  font-weight: 500;
}

.book-reader-display-controls button.is-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
  font-weight: 600;
}

.book-reader-display-controls__theme-btn.is-paper {
  background: #ffffff;
  color: #0f172a;
}

.book-reader-display-controls__theme-btn.is-sepia {
  background: #fbf0d9;
  color: #2d2013;
  border-color: #ebdcc0;
}

.book-reader-display-controls__theme-btn.is-slate {
  background: #f1f5f9;
  color: #1e293b;
  border-color: #e2e8f0;
}

.book-reader-display-controls__theme-btn.is-night {
  background: #18181b;
  color: #e4e4e7;
  border-color: #3f3f46;
}

.book-reader-display-controls button:focus-visible,
.book-reader-display-controls select:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}
</style>
