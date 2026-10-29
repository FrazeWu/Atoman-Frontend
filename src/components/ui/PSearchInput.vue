<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Search, X, Loader2 } from 'lucide-vue-next'

export interface SearchScopeOption {
  label: string
  value: string
}

export interface PSearchInputProps {
  id?: string
  inputTestId?: string
  dropdownTestId?: string
  modelValue?: string
  variant?: 'bar' | 'inline'
  size?: 'sm' | 'md' | 'lg'
  placeholder?: string
  showActionButton?: boolean
  actionButtonText?: string
  scopes?: SearchScopeOption[]
  scope?: string
  showSearchIcon?: boolean
  clearable?: boolean
  showShortcutBadge?: boolean
  shortcutKey?: string
  enableGlobalShortcut?: boolean
  debounceMs?: number
  loading?: boolean
  disabled?: boolean
  ariaLabel?: string
  showDropdown?: boolean
  role?: string
  ariaExpanded?: boolean
  ariaControls?: string
  ariaActiveDescendant?: string
  ariaAutocomplete?: 'list' | 'both' | 'inline' | 'none'
}

const props = withDefaults(defineProps<PSearchInputProps>(), {
  id: '',
  inputTestId: '',
  dropdownTestId: '',
  modelValue: '',
  variant: 'bar',
  size: undefined,
  placeholder: '搜索...',
  showActionButton: undefined,
  actionButtonText: '搜索',
  scopes: () => [],
  scope: '',
  showSearchIcon: true,
  clearable: true,
  showShortcutBadge: undefined,
  shortcutKey: '⌘K',
  enableGlobalShortcut: false,
  debounceMs: 0,
  loading: false,
  disabled: false,
  ariaLabel: '搜索',
  showDropdown: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:scope', scope: string): void
  (e: 'search', query: string, scope?: string): void
  (e: 'clear'): void
  (e: 'focus', ev: FocusEvent): void
  (e: 'blur', ev: FocusEvent): void
  (e: 'keydown', ev: KeyboardEvent): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const innerValue = ref(props.modelValue)

watch(
  () => props.modelValue,
  (val) => {
    innerValue.value = val ?? ''
  }
)

const localScope = computed({
  get: () => props.scope,
  set: (val: string) => {
    emit('update:scope', val)
  },
})

const actualSize = computed(() => {
  if (props.size) return props.size
  return props.variant === 'bar' ? 'lg' : 'md'
})

const shouldShowActionButton = computed(() => {
  if (props.showActionButton !== undefined) return props.showActionButton
  return props.variant === 'bar'
})

const shouldShowBadge = computed(() => {
  if (props.showShortcutBadge !== undefined) return props.showShortcutBadge
  return props.variant === 'inline'
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  const value = target.value
  innerValue.value = value

  if (props.debounceMs > 0) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      emit('update:modelValue', value)
    }, props.debounceMs)
  } else {
    emit('update:modelValue', value)
  }
}

const handleClear = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  innerValue.value = ''
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}

const triggerSearch = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    emit('update:modelValue', innerValue.value)
  }
  emit('search', innerValue.value, props.scope || undefined)
}

const handleEnter = (e: KeyboardEvent) => {
  if (e.isComposing || e.defaultPrevented) return
  triggerSearch()
}

const handleKeydown = (e: KeyboardEvent) => {
  emit('keydown', e)
}

const handleActionClick = () => {
  triggerSearch()
}

const handleFocus = (e: FocusEvent) => {
  isFocused.value = true
  emit('focus', e)
}

const handleBlur = (e: FocusEvent) => {
  isFocused.value = false
  emit('blur', e)
}

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (!props.enableGlobalShortcut) return
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    inputRef.value?.focus()
  }
}

onMounted(() => {
  if (props.enableGlobalShortcut) {
    window.addEventListener('keydown', handleGlobalKeydown)
  }
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (props.enableGlobalShortcut) {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
})

defineExpose({
  inputRef,
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  clear: handleClear,
})
</script>

<template>
  <div
    class="p-search-input"
    :class="[
      `p-search-input--${variant}`,
      `p-search-input--${actualSize}`,
      {
        'is-focused': isFocused,
        'is-disabled': disabled,
      },
    ]"
    role="search"
  >
    <!-- Scope Selector (Option 1A Integrated Bar) -->
    <div v-if="scopes && scopes.length > 0" class="p-search-input__scope">
      <slot name="scopes">
        <select
          v-model="localScope"
          class="p-search-input__scope-select"
          :disabled="disabled"
          aria-label="搜索范围"
        >
          <option
            v-for="item in scopes"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </slot>
    </div>

    <!-- Main Input Section -->
    <div class="p-search-input__main">
      <div v-if="showSearchIcon" class="p-search-input__icon-wrap">
        <slot name="prefix">
          <Search class="p-search-input__icon" />
        </slot>
      </div>

      <input
        :id="id"
        ref="inputRef"
        type="search"
        class="p-search-input__input"
        :role="role === 'combobox' ? 'combobox' : undefined"
        :aria-expanded="role === 'combobox' ? ariaExpanded : undefined"
        :aria-controls="ariaControls"
        :aria-activedescendant="ariaActiveDescendant"
        :aria-autocomplete="ariaAutocomplete || (role === 'combobox' ? 'list' : undefined)"
        :aria-haspopup="role === 'combobox' ? 'listbox' : undefined"
        :value="innerValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :data-testid="inputTestId || undefined"
        @input="handleInput"
        @keydown="handleKeydown"
        @keydown.enter="handleEnter"
        @focus="handleFocus"
        @blur="handleBlur"
      />

      <div class="p-search-input__suffix">
        <Loader2 v-if="loading" class="p-search-input__loader animate-spin" />
        <button
          v-else-if="clearable && innerValue"
          type="button"
          class="p-search-input__clear-btn"
          aria-label="清空搜索"
          :disabled="disabled"
          @click="handleClear"
        >
          <X class="p-search-input__clear-icon" />
        </button>
        <kbd
          v-else-if="shouldShowBadge && shortcutKey && !isFocused"
          class="p-search-input__badge"
        >
          {{ shortcutKey }}
        </kbd>
      </div>
    </div>

    <!-- Action Button (Option 1A Integrated Bar) -->
    <div v-if="shouldShowActionButton" class="p-search-input__action">
      <slot name="action">
        <button
          type="button"
          class="p-search-input__action-btn"
          :disabled="disabled || loading"
          @click="handleActionClick"
        >
          {{ actionButtonText }}
        </button>
      </slot>
    </div>

    <!-- Dropdown Slot Container -->
    <div
      v-if="showDropdown"
      class="p-search-input__dropdown"
      tabindex="-1"
      :data-testid="dropdownTestId || undefined"
    >
      <slot name="dropdown" />
    </div>
  </div>
</template>

<style scoped>
.p-search-input {
  display: inline-flex;
  align-items: stretch;
  background-color: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
}

.p-search-input.is-focused {
  border-color: var(--a-color-primary, #0ea5e9);
}

.p-search-input.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--a-color-bg-subtle, #f8fafc);
}

/* Variant: bar (Option 1A integrated) */
.p-search-input--bar {
  width: 100%;
}

/* Variant: inline */
.p-search-input--inline {
  width: auto;
}

/* Sizes */
.p-search-input--sm {
  height: 32px;
  font-size: 13px;
}

.p-search-input--md {
  height: 38px;
  font-size: 14px;
}

.p-search-input--lg {
  height: 44px;
  font-size: 15px;
}

/* Scope Selector */
.p-search-input__scope {
  display: flex;
  align-items: center;
  border-right: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: var(--a-color-bg-subtle, #f8fafc);
  border-top-left-radius: calc(var(--a-radius-control, 4px) - 1px);
  border-bottom-left-radius: calc(var(--a-radius-control, 4px) - 1px);
  padding: 0 4px;
  flex-shrink: 0;
}

.p-search-input__scope-select {
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary, #64748b);
  font-size: 13px;
  font-weight: 500;
  padding: 0 8px;
  height: 100%;
  outline: none;
  cursor: pointer;
  box-shadow: none !important;
}

.p-search-input__scope-select:disabled {
  cursor: not-allowed;
}

/* Main Input Section */
.p-search-input__main {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  position: relative;
}

.p-search-input__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  color: var(--a-color-text-tertiary, #94a3b8);
  flex-shrink: 0;
}

.p-search-input__icon {
  width: 16px;
  height: 16px;
}

.p-search-input--sm .p-search-input__icon {
  width: 14px;
  height: 14px;
}

.p-search-input--lg .p-search-input__icon {
  width: 18px;
  height: 18px;
}

.p-search-input__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--a-color-text-primary, #0f172a);
  font-size: inherit;
  box-shadow: none !important;
  padding: 0;
}

/* Remove WebKit search cancel button to avoid duplicate UI */
.p-search-input__input::-webkit-search-cancel-button {
  display: none;
}

.p-search-input__input::placeholder {
  color: var(--a-color-text-tertiary, #94a3b8);
}

.p-search-input__input:disabled {
  cursor: not-allowed;
}

/* Suffix Items */
.p-search-input__suffix {
  display: flex;
  align-items: center;
  margin-left: 8px;
  flex-shrink: 0;
}

.p-search-input__loader {
  width: 16px;
  height: 16px;
  color: var(--a-color-text-tertiary, #94a3b8);
}

.p-search-input__clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-text-tertiary, #94a3b8);
  cursor: pointer;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.p-search-input__clear-btn:hover {
  color: var(--a-color-text-primary, #0f172a);
  background-color: var(--a-color-bg-subtle, #f1f5f9);
}

.p-search-input__clear-btn:disabled {
  cursor: not-allowed;
}

.p-search-input__clear-icon {
  width: 14px;
  height: 14px;
}

.p-search-input__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  color: var(--a-color-text-tertiary, #94a3b8);
  background-color: var(--a-color-bg-subtle, #f1f5f9);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  line-height: 1;
  user-select: none;
  pointer-events: none;
}

/* Action Button */
.p-search-input__action {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  border-left: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.p-search-input__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background-color: var(--a-color-primary, #0ea5e9);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  padding: 0 18px;
  cursor: pointer;
  box-shadow: none !important;
  border-top-right-radius: calc(var(--a-radius-control, 4px) - 1px);
  border-bottom-right-radius: calc(var(--a-radius-control, 4px) - 1px);
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.p-search-input--sm .p-search-input__action-btn {
  padding: 0 12px;
  font-size: 13px;
}

.p-search-input--lg .p-search-input__action-btn {
  padding: 0 22px;
  font-size: 15px;
}

.p-search-input__action-btn:hover:not(:disabled) {
  filter: brightness(0.96);
}

.p-search-input__action-btn:active:not(:disabled) {
  filter: brightness(0.92);
}

.p-search-input__action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Dropdown Slot Container */
.p-search-input__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background-color: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
  z-index: 50;
  max-height: 420px;
  overflow-y: auto;
  box-sizing: border-box;
}

.p-search-input--inline .p-search-input__dropdown {
  min-width: 320px;
}
</style>
