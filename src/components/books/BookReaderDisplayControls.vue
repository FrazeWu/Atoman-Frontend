<template>
  <section class="book-reader-display-controls" aria-label="阅读显示偏好">
    <label>
      <span>字号</span>
      <select :value="modelValue.font_scale" aria-label="字号" @change="setFontScale">
        <option :value="0.85">小</option>
        <option :value="1">标准</option>
        <option :value="1.15">大</option>
        <option :value="1.35">特大</option>
      </select>
    </label>
    <div class="book-reader-display-controls__themes" role="group" aria-label="阅读主题">
      <button type="button" :class="{ 'is-active': modelValue.theme === 'paper' }" aria-label="纸张主题" @click="setTheme('paper')">纸</button>
      <button type="button" :class="{ 'is-active': modelValue.theme === 'dim' }" aria-label="柔和主题" @click="setTheme('dim')">柔</button>
      <button type="button" :class="{ 'is-active': modelValue.theme === 'night' }" aria-label="夜间主题" @click="setTheme('night')">夜</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { BookReaderDisplayPreferences, BookReaderTheme } from '@/utils/bookReaderPreferences'

const props = defineProps<{ modelValue: BookReaderDisplayPreferences }>()
const emit = defineEmits<{ 'update:modelValue': [value: BookReaderDisplayPreferences] }>()

function setFontScale(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('update:modelValue', { ...props.modelValue, font_scale: value })
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
  color: var(--a-color-muted);
  font-size: 0.82rem;
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
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control);
  background: var(--book-reader-surface, var(--a-color-surface, #ffffff));
  color: var(--book-reader-text, var(--a-color-fg));
}

.book-reader-display-controls select {
  padding: 0 0.4rem;
}

.book-reader-display-controls button {
  min-width: 2rem;
  padding: 0 0.45rem;
  cursor: pointer;
}

.book-reader-display-controls button.is-active {
  border-color: var(--a-color-primary);
  color: var(--a-color-primary);
  font-weight: 600;
}

.book-reader-display-controls button:focus-visible,
.book-reader-display-controls select:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}
</style>
