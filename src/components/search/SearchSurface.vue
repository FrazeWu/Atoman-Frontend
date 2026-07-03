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
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 0.6rem 0.8rem 0.65rem;
  display: grid;
  align-items: center; /* 确保垂直居中 */
  gap: 0.4rem;
  overflow: hidden;
  box-sizing: border-box;
  height: 100%;
  transition:
    width 0.6s cubic-bezier(0.2, 1, 0.2, 1),
    padding 0.6s cubic-bezier(0.2, 1, 0.2, 1),
    box-shadow 0.6s cubic-bezier(0.2, 1, 0.2, 1),
    gap 0.6s cubic-bezier(0.2, 1, 0.2, 1);
}

.search-frame.is-open:not(.is-overlay-results) {
  padding-bottom: 0;
}

.search-frame.is-compact {
  padding: 0 1rem; /* 内部完全靠 flex 垂直居中，高度由外部容器指定 */
  gap: 0.35rem;
}

.search-frame.is-compact .search-frame__eyebrow,
.search-frame.is-compact .search-frame__status {
  font-size: 0.68rem;
}

.search-frame.is-compact .search-input {
  font-size: 0.98rem;
}

.search-main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  box-sizing: border-box;
}

.search-btn {
  border: none;
  background: transparent;
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 800;
  padding: 0 0.5rem;
  white-space: nowrap;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover {
  color: var(--a-color-muted);
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
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.search-frame__eyebrow {
  color: var(--a-color-muted-soft);
}

.search-frame__status {
  color: var(--a-color-ink-soft);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  border-bottom: 1px solid transparent;
  transition: border-bottom-color 0.2s ease;
}

.search-input-wrapper:focus-within {
  border-bottom-color: var(--a-color-accent-confirm);
}

.search-input-wrapper:focus-within .search-icon {
  color: var(--a-color-ink);
}

.search-icon {
  color: var(--a-color-muted-soft);
  pointer-events: none;
  transition: color 0.2s ease;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.search-input {
  width: 100%;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--a-color-ink);
  padding: 0.35rem 0;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

.search-frame.is-compact .search-input {
  padding: 0.25rem 0 !important;
}

.search-input:focus {
  outline: none;
}


.search-dropdown {
  margin-top: 0.25rem;
  padding: 0.75rem 0 0;
  border-top: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
  background: transparent;
  max-height: 420px;
  overflow-y: auto;
  animation: searchSurfaceReveal 0.6s cubic-bezier(0.2, 1, 0.2, 1);
}

.search-frame.is-overlay-results {
  overflow: visible;
}

.search-frame.is-open.is-overlay-results {
  box-shadow: none;
}

.search-frame.is-overlay-results .search-dropdown {
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  right: 0;
  margin-top: 0;
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  border: var(--a-border);
  border-top: 0;
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  z-index: 80;
}

.search-dropdown__hint {
  margin: 0;
  padding: 0.75rem 1.05rem;
  color: var(--a-color-muted);
  font-size: 0.88rem;
  font-weight: 700;
}

.search-actions {
  display: inline-flex;
  align-items: stretch;
  justify-self: end;
  padding-top: 0.35rem;
  white-space: nowrap;
}

.search-actions :deep(.paper-action) {
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 0.35rem 0;
  min-height: auto;
}

.search-actions :deep(.paper-action:hover) {
  background: transparent;
  color: var(--a-color-ink);
  box-shadow: none;
}

@keyframes searchSurfaceReveal {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
    padding-top: 0.75rem;
    border-top: 1px solid color-mix(in srgb, var(--a-color-ink) 12%, transparent);
  }
}

.search-dropdown-slide-enter-active,
.search-dropdown-slide-leave-active {
  transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
  overflow: hidden;
}

.search-dropdown-slide-enter-from,
.search-dropdown-slide-leave-to {
  max-height: 0 !important;
  opacity: 0;
}
</style>
