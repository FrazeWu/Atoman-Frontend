<template>
  <div
    class="p-reference-menu"
    :class="{ 'p-reference-menu--fixed': position }"
    :style="position ? { top: `${position.top}px`, left: `${position.left}px` } : undefined"
    role="listbox"
    aria-label="引用候选"
  >
    <div v-if="loading && suggestions.length === 0" class="p-reference-menu__state" role="status">正在搜索...</div>
    <button
      v-for="(suggestion, index) in suggestions"
      :key="suggestion.key"
      type="button"
      role="option"
      :aria-selected="index === activeIndex"
      class="p-reference-menu__option"
      :class="{ 'is-active': index === activeIndex }"
      @mouseenter="$emit('hover', index)"
      @mousedown.prevent="$emit('select', suggestion)"
    >
      <span class="p-reference-menu__label">{{ suggestion.label }}</span>
      <span class="p-reference-menu__meta">
        {{ suggestion.kind === 'type' ? `@${suggestion.targetType}:` : suggestion.subtitle || suggestion.targetType }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ReferenceSuggestion } from '@/composables/useReferenceAutocomplete'

defineProps<{
  suggestions: ReferenceSuggestion[]
  activeIndex: number
  loading?: boolean
  position?: { top: number; left: number }
}>()

defineEmits<{
  select: [suggestion: ReferenceSuggestion]
  hover: [index: number]
}>()
</script>

<style scoped>
.p-reference-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 4px);
  left: 0;
  width: min(100%, 24rem);
  max-height: 18rem;
  overflow-y: auto;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-md);
}

.p-reference-menu--fixed {
  position: fixed;
  width: min(24rem, calc(100vw - 24px));
}

.p-reference-menu__option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.p-reference-menu__option:last-child { border-bottom: 0; }
.p-reference-menu__option:hover,
.p-reference-menu__option:focus-visible,
.p-reference-menu__option.is-active { background: var(--a-color-surface-muted); }
.p-reference-menu__option:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: -2px; }
.p-reference-menu__label { min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
.p-reference-menu__meta { color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.p-reference-menu__state { min-height: 44px; padding: 12px; color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
</style>
