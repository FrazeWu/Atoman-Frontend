<template>
  <div class="search-surface">
    <div class="search-frame" :class="{
      'is-open': showDropdown,
      'is-compact': compact && !showDropdown,
      'is-overlay-results': overlayResults
    }">
      <div v-if="eyebrow || status" class="search-frame__head">
        <span class="search-frame__eyebrow">{{ eyebrow }}</span>
        <span v-if="status" class="search-frame__status">{{ status }}</span>
      </div>

      <div class="search-main">
        <slot name="input">
          <div class="search-input-wrapper">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              :value="query"
              class="search-input"
              type="text"
              :placeholder="placeholder"
              :data-testid="inputTestId"
              @input="handleInput"
              @focus="$emit('focus')"
              @blur="$emit('blur')"
              @keydown.enter="$emit('submit')"
            >
            <button
              v-if="query"
              type="button"
              class="search-clear-btn"
              aria-label="清空搜索词"
              title="清空"
              @click="$emit('update:query', '')"
            >
              ✕
            </button>
          </div>
        </slot>

        <button
          v-if="showSubmit"
          class="search-btn"
          type="button"
          @click="$emit('submit')"
        >
          搜索
        </button>

        <div v-if="$slots.actions" class="search-actions">
          <slot name="actions" />
        </div>
      </div>

      <Transition name="search-dropdown-slide">
        <div v-if="showDropdown" class="search-dropdown" :data-testid="dropdownTestId" :style="dropdownStyle">
          <p v-if="loading" class="search-dropdown__hint">搜索中...</p>
          <template v-else-if="$slots.results">
            <slot name="results" />
          </template>
          <p v-else-if="empty" class="search-dropdown__hint">{{ empty }}</p>
          <p v-else-if="hint" class="search-dropdown__hint">{{ hint }}</p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(defineProps<{
  query: string
  open: boolean
  eyebrow: string
  compact?: boolean
  overlayResults?: boolean
  showSubmit?: boolean
  status?: string
  placeholder?: string
  inputTestId?: string
  dropdownTestId?: string
  dropdownHeight?: string
  loading?: boolean
  hint?: string
  empty?: string
}>(), {
  compact: false,
  overlayResults: false,
  showSubmit: true,
  status: '',
  placeholder: '搜索...',
  inputTestId: '',
  dropdownTestId: 'search-surface-dropdown',
  dropdownHeight: '',
  loading: false,
  hint: '',
  empty: '',
})

const slots = useSlots()

const emit = defineEmits<{
  'update:query': [string]
  focus: []
  blur: []
  submit: []
}>()

const showDropdown = computed(() => (
  props.open && (
    props.loading ||
    Boolean(props.hint) ||
    Boolean(props.empty) ||
    Boolean(slots.results)
  )
))

const dropdownStyle = computed(() => (
  props.dropdownHeight
    ? { minHeight: props.dropdownHeight, maxHeight: props.dropdownHeight }
    : {}
))

function handleInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value)
}
</script>

<style scoped>
.search-surface {
  width: 100%;
  height: 100%;
}

.search-frame {
  flex: 1;
  width: 100%;
  min-width: min(100%, 24rem);
  position: relative;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
  box-shadow: var(--a-shadow-sm);
  padding: 0.65rem 0.85rem;
  display: grid;
  align-items: center;
  gap: 0.4rem;
  overflow: hidden;
  box-sizing: border-box;
  height: 100%;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-frame:focus-within {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-md);
}

.search-frame.is-open:not(.is-overlay-results) {
  padding-bottom: 0;
}

.search-frame.is-compact {
  padding: 0 0.85rem;
  gap: 0.35rem;
}

.search-frame.is-compact .search-frame__eyebrow,
.search-frame.is-compact .search-frame__status {
  font-size: 0.68rem;
}

.search-frame.is-compact .search-input {
  font-size: 0.95rem;
}

.search-main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  box-sizing: border-box;
}

.search-btn {
  border: 1px solid var(--a-color-text);
  border-radius: var(--a-radius-control);
  background: var(--a-color-text);
  color: var(--a-color-bg);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  white-space: nowrap;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover {
  opacity: 0.9;
}

.search-frame__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.search-frame__eyebrow,
.search-frame__status {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.search-frame__eyebrow {
  color: var(--a-color-muted-soft);
}

.search-frame__status {
  color: var(--a-color-muted);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  flex: 1;
}

.search-icon {
  color: var(--a-color-muted-soft);
  pointer-events: none;
  transition: color 0.2s ease;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.search-frame:focus-within .search-icon {
  color: var(--a-color-primary);
}

.search-input {
  width: 100%;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  padding: 0.35rem 0;
  font-size: 0.98rem;
  font-family: inherit;
  box-sizing: border-box;
}

.search-frame.is-compact .search-input {
  padding: 0.25rem 0 !important;
}

.search-input:focus {
  outline: none;
}

.search-clear-btn {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  font-size: 0.75rem;
  border-radius: 4px;
}

.search-clear-btn:hover {
  color: var(--a-color-fg);
}

.search-dropdown {
  margin-top: 0.25rem;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--a-color-border-soft);
  background: transparent;
  max-height: 420px;
  overflow-y: auto;
}

.search-frame.is-overlay-results {
  overflow: visible;
}

.search-frame.is-open.is-overlay-results {
  box-shadow: none;
}

.search-frame.is-overlay-results .search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  margin-top: 0;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-dropdown);
  z-index: 80;
}

.search-dropdown__hint {
  margin: 0;
  padding: 0.75rem 1.05rem;
  color: var(--a-color-muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.search-actions {
  display: inline-flex;
  align-items: stretch;
  justify-self: end;
  white-space: nowrap;
}

.search-actions :deep(.ui-action) {
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 0.35rem 0;
  min-height: auto;
}

.search-actions :deep(.ui-action:hover) {
  background: transparent;
  color: var(--a-color-text);
  box-shadow: none;
}

@media (max-width: 720px) {
  .search-frame {
    min-width: 100%;
  }

  .search-main {
    gap: 0.75rem;
  }

  .search-actions {
    justify-self: stretch;
    padding-top: 0.5rem;
    border-top: 1px solid var(--a-color-border-soft);
  }
}

.search-dropdown-slide-enter-active,
.search-dropdown-slide-leave-active {
  transition: max-height 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease;
  overflow: hidden;
}

.search-dropdown-slide-enter-from,
.search-dropdown-slide-leave-to {
  max-height: 0 !important;
  opacity: 0;
}
</style>
