<template>
  <div class="search-surface">
    <div class="search-frame" :class="{ 'is-open': showDropdown, 'is-compact': compact && !showDropdown }">
      <div class="search-frame__head">
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
            >
          </div>
        </slot>

        <div v-if="$slots.actions" class="search-actions">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="showDropdown" class="search-dropdown" :data-testid="dropdownTestId">
        <p v-if="loading" class="search-dropdown__hint">搜索中...</p>
        <template v-else-if="$slots.results">
          <slot name="results" />
        </template>
        <p v-else-if="empty" class="search-dropdown__hint">{{ empty }}</p>
        <p v-else-if="hint" class="search-dropdown__hint">{{ hint }}</p>
      </div>
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
  status?: string
  placeholder?: string
  inputTestId?: string
  dropdownTestId?: string
  loading?: boolean
  hint?: string
  empty?: string
}>(), {
  compact: false,
  status: '',
  placeholder: '搜索...',
  inputTestId: '',
  dropdownTestId: 'search-surface-dropdown',
  loading: false,
  hint: '',
  empty: '',
})

const slots = useSlots()

const emit = defineEmits<{
  'update:query': [string]
  focus: []
  blur: []
}>()

const showDropdown = computed(() => (
  props.open && (
    props.loading ||
    Boolean(props.hint) ||
    Boolean(props.empty) ||
    Boolean(slots.results)
  )
))

function handleInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value)
}
</script>

<style scoped>
.search-surface {
  width: 100%;
}

.search-frame {
  flex: 1;
  width: 100%;
  min-width: min(100%, 24rem);
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 1rem 1.05rem 1.1rem;
  display: grid;
  gap: 0.6rem;
  overflow: hidden;
  transition:
    width 0.48s cubic-bezier(0.16, 1, 0.3, 1),
    padding 0.48s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.48s cubic-bezier(0.16, 1, 0.3, 1),
    gap 0.48s cubic-bezier(0.16, 1, 0.3, 1);
}

.search-frame.is-open {
  padding-bottom: 0;
}

.search-frame.is-compact {
  padding: 0.82rem 0.92rem 0.88rem;
  gap: 0.55rem;
}

.search-frame.is-compact .search-frame__eyebrow,
.search-frame.is-compact .search-frame__status {
  font-size: 0.68rem;
}

.search-frame.is-compact .search-input {
  font-size: 0.98rem;
  padding-bottom: 0.72rem;
}

.search-main {
  display: grid;
  gap: 0.7rem;
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
}

.search-icon {
  position: absolute;
  left: 0;
  bottom: 0.95rem;
  color: var(--a-color-muted-soft);
  pointer-events: none;
  transition: color 0.2s ease;
}

.search-frame.is-compact .search-icon {
  bottom: 0.75rem;
}

.search-input {
  width: 100%;
  flex: 1;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  padding: 0 0 0.9rem 1.75rem;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

.search-frame.is-compact .search-input {
  padding-left: 1.75rem !important;
}

.search-input:focus {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.search-input:focus + .search-icon {
  color: var(--a-color-ink);
}

.search-dropdown {
  margin-top: 0.25rem;
  padding: 0.75rem 0 0;
  border-top: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
  background: transparent;
  max-height: 420px;
  overflow-y: auto;
  animation: searchSurfaceReveal 0.52s cubic-bezier(0.16, 1, 0.3, 1);
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
</style>
