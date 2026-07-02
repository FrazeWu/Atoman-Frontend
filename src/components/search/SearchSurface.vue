<template>
  <div class="search-surface">
    <div class="search-frame">
      <div class="search-frame__head">
        <span class="search-frame__eyebrow">{{ eyebrow }}</span>
        <span v-if="status" class="search-frame__status">{{ status }}</span>
      </div>

      <slot name="input">
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
      </slot>

      <div v-if="open" class="search-dropdown" :data-testid="dropdownTestId">
        <p v-if="loading" class="search-dropdown__hint">搜索中...</p>
        <template v-else-if="$slots.results">
          <slot name="results" />
        </template>
        <p v-else-if="empty" class="search-dropdown__hint">{{ empty }}</p>
        <p v-else-if="hint" class="search-dropdown__hint">{{ hint }}</p>
      </div>
    </div>

    <div v-if="$slots.actions" class="search-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  query: string
  open: boolean
  eyebrow: string
  status?: string
  placeholder?: string
  inputTestId?: string
  dropdownTestId?: string
  loading?: boolean
  hint?: string
  empty?: string
}>(), {
  status: '',
  placeholder: '搜索...',
  inputTestId: '',
  dropdownTestId: 'search-surface-dropdown',
  loading: false,
  hint: '',
  empty: '',
})

const emit = defineEmits<{
  'update:query': [string]
  focus: []
  blur: []
}>()

function handleInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value)
}
</script>

<style scoped>
.search-surface {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-frame {
  flex: 1;
  min-width: min(100%, 24rem);
  position: relative;
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 0.8rem 0.95rem 0.9rem;
  display: grid;
  gap: 0.6rem;
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

.search-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  padding: 0 0 0.72rem;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-paper) 94%, #f3eee5 6%);
  box-shadow: 0 10px 24px rgba(18, 18, 18, 0.05);
  padding: 0.55rem 0;
}

.search-dropdown__hint {
  margin: 0;
  padding: 0.55rem 0.95rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.search-actions {
  display: inline-flex;
  align-items: flex-start;
}

@media (max-width: 720px) {
  .search-surface {
    flex-direction: column;
    align-items: stretch;
  }

  .search-frame {
    min-width: 100%;
  }
}
</style>
