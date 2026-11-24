<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Search, X, Loader2, ChevronDown, Check } from 'lucide-vue-next'

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
  actionButtonVariant?: 'primary' | 'secondary' | 'neutral'
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
  actionButtonVariant: 'primary',
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

const isScopeOpen = ref(false)
const scopeDropdownRef = ref<HTMLElement | null>(null)

const currentScopeLabel = computed(() => {
  const found = props.scopes?.find((s) => s.value === localScope.value)
  return found?.label || props.scopes?.[0]?.label || ''
})

const selectScope = (val: string) => {
  localScope.value = val
  isScopeOpen.value = false
}

const toggleScopeDropdown = () => {
  if (props.disabled) return
  isScopeOpen.value = !isScopeOpen.value
}

const handleScopeClickOutside = (e: MouseEvent) => {
  if (scopeDropdownRef.value && !scopeDropdownRef.value.contains(e.target as Node)) {
    isScopeOpen.value = false
  }
}

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
const isComposing = ref(false)

const handleCompositionStart = () => {
  isComposing.value = true
}

const handleCompositionEnd = (e: Event) => {
  if (!isComposing.value) return
  isComposing.value = false
  handleInput(e)
}

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  const value = target.value
  innerValue.value = value

  if (isComposing.value) return

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
  document.addEventListener('click', handleScopeClickOutside)
  if (props.enableGlobalShortcut) {
    window.addEventListener('keydown', handleGlobalKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleScopeClickOutside)
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
    <!-- Scope Selector (Cupertino Dropdown) -->
    <div v-if="scopes && scopes.length > 0" ref="scopeDropdownRef" class="p-search-input__scope">
      <slot name="scopes">
        <button
          type="button"
          class="p-search-input__scope-trigger"
          :disabled="disabled"
          aria-haspopup="listbox"
          :aria-expanded="isScopeOpen"
          aria-label="搜索范围"
          @click="toggleScopeDropdown"
        >
          <span class="p-search-input__scope-label">{{ currentScopeLabel }}</span>
          <ChevronDown class="p-search-input__scope-chevron" :class="{ 'is-open': isScopeOpen }" :size="12" />
        </button>

        <!-- Cupertino Floating Popover Menu -->
        <transition name="p-scope-menu">
          <div
            v-if="isScopeOpen"
            class="p-search-input__scope-menu"
            role="listbox"
            aria-label="搜索范围选项"
          >
            <button
              v-for="item in scopes"
              :key="item.value"
              type="button"
              class="p-search-input__scope-option"
              :class="{ 'is-selected': item.value === localScope }"
              role="option"
              :aria-selected="item.value === localScope"
              @click="selectScope(item.value)"
            >
              <Check v-if="item.value === localScope" class="p-search-input__scope-check" :size="13" />
              <span v-else class="p-search-input__scope-check-spacer" />
              <span class="p-search-input__scope-option-text">{{ item.label }}</span>
            </button>
          </div>
        </transition>

        <!-- Hidden Native Select for Screen Readers and Automated Tests -->
        <select
          v-model="localScope"
          class="p-search-input__scope-select sr-only"
          :disabled="disabled"
          tabindex="-1"
          aria-hidden="true"
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
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
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
          :class="`p-search-input__action-btn--${actionButtonVariant}`"
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
  background-color: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
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
  border-right: 1px solid var(--a-color-border-soft);
  background-color: var(--a-color-bg-subtle, #f8fafc);
  border-top-left-radius: calc(var(--a-radius-control, 4px) - 1px);
  border-bottom-left-radius: calc(var(--a-radius-control, 4px) - 1px);
  padding: 0 4px;
  flex-shrink: 0;
  position: relative;
}

.p-search-input__scope-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--a-color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  padding: 0 8px;
  height: 100%;
  cursor: pointer;
  outline: none;
  border-radius: calc(var(--a-radius-control, 4px) - 1px);
  transition: color 0.15s ease, background-color 0.15s ease;
  user-select: none;
}

.p-search-input__scope-trigger:hover:not(:disabled) {
  color: var(--a-color-text);
  background-color: var(--a-color-bg-hover, rgba(0, 0, 0, 0.04));
}

.p-search-input__scope-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.p-search-input__scope-label {
  line-height: 1;
}

.p-search-input__scope-chevron {
  transition: transform 0.18s ease;
  color: var(--a-color-text-tertiary, #94a3b8);
}

.p-search-input__scope-chevron.is-open {
  transform: rotate(180deg);
}

/* Floating Popover Menu (Zero OS Default Styling) */
.p-search-input__scope-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 108px;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 4px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.p-search-input__scope-option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--a-color-text);
  background: transparent;
  border: none;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
}

.p-search-input__scope-option:hover {
  background-color: var(--a-color-bg-hover, rgba(0, 0, 0, 0.04));
}

.p-search-input__scope-option.is-selected {
  font-weight: 500;
  color: var(--a-color-primary, #007aff);
}

.p-search-input__scope-check {
  color: var(--a-color-primary, #007aff);
  flex-shrink: 0;
}

.p-search-input__scope-check-spacer {
  width: 13px;
  flex-shrink: 0;
}

.p-search-input__scope-select.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Transitions */
.p-scope-menu-enter-active,
.p-scope-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.p-scope-menu-enter-from,
.p-scope-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
  border: 1px solid var(--a-color-border-soft);
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
  border-left: 1px solid var(--a-color-border-soft);
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
  transition: background-color 0.15s ease, opacity 0.15s ease, color 0.15s ease;
}

.p-search-input__action-btn--secondary,
.p-search-input__action-btn--neutral {
  background-color: var(--a-color-surface-muted, #f4f4f5);
  color: var(--a-color-text, #374151);
  border-left: 1px solid var(--a-border-subtle, rgba(0, 0, 0, 0.08));
}

.p-search-input__action-btn--secondary:hover:not(:disabled),
.p-search-input__action-btn--neutral:hover:not(:disabled) {
  background-color: var(--a-color-border-soft, #e4e4e7);
  color: var(--a-color-text-emphasis, #111827);
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
  left: -1px;
  right: -1px;
  background-color: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
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
