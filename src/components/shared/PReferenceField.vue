<template>
  <div ref="rootRef" class="p-reference-field" @keydown="handleKeydown">
    <PInput
      v-if="variant === 'input'"
      v-bind="$attrs"
      :model-value="currentValue"
      :label="label"
      :placeholder="placeholder"
      :error="error"
      :disabled="disabled"
      aria-autocomplete="list"
      :aria-expanded="visible"
      @input="handleInput"
      @click="handleCursorEvent"
      @keyup="handleCursorEvent"
    >
      <template #suffix>
        <button
          type="button"
          class="p-reference-field__trigger"
          title="添加引用"
          aria-label="添加引用"
          :aria-expanded="visible"
          :disabled="disabled"
          data-test="reference-trigger"
          @click="insertTrigger"
        >
          <AtSign :size="18" aria-hidden="true" />
        </button>
      </template>
    </PInput>
    <PTextarea
      v-else
      v-bind="$attrs"
      :model-value="currentValue"
      :label="label"
      :placeholder="placeholder"
      :error="error"
      :disabled="disabled"
      :rows="rows"
      aria-autocomplete="list"
      :aria-expanded="visible"
      @input="handleInput"
      @click="handleCursorEvent"
      @keyup="handleCursorEvent"
    >
      <template #suffix>
        <button
          type="button"
          class="p-reference-field__trigger"
          title="添加引用"
          aria-label="添加引用"
          :aria-expanded="visible"
          :disabled="disabled"
          data-test="reference-trigger"
          @click="insertTrigger"
        >
          <AtSign :size="18" aria-hidden="true" />
        </button>
      </template>
    </PTextarea>
    <PReferenceMenu
      v-if="visible && (loading || suggestions.length > 0)"
      :suggestions="suggestions"
      :active-index="activeIndex"
      :loading="loading"
      @hover="activeIndex = $event"
      @select="applySuggestion"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AtSign } from 'lucide-vue-next'

import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PReferenceMenu from './PReferenceMenu.vue'
import {
  insertReferenceTrigger,
  parseReferenceTrigger,
  referenceTokenForSuggestion,
  searchReferenceSuggestions,
  type ReferenceSuggestion,
  type ReferenceTrigger,
} from '@/composables/useReferenceAutocomplete'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  variant?: 'input' | 'textarea'
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  rows?: number
}>(), {
  modelValue: '',
  variant: 'input',
  label: '',
  placeholder: '',
  error: '',
  disabled: false,
  rows: 4,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const rootRef = ref<HTMLElement | null>(null)
const controlRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const currentValue = ref(props.modelValue)
const suggestions = ref<ReferenceSuggestion[]>([])
const activeIndex = ref(0)
const visible = ref(false)
const loading = ref(false)
let trigger: ReferenceTrigger | null = null
let request = 0
let debounce: ReturnType<typeof setTimeout> | null = null

function close() {
  visible.value = false
  loading.value = false
  suggestions.value = []
  activeIndex.value = 0
  trigger = null
  request++
  if (debounce) clearTimeout(debounce)
  debounce = null
}

function schedule(value: string, cursor: number) {
  trigger = parseReferenceTrigger(value.slice(0, cursor))
  if (!trigger) {
    close()
    return
  }
  visible.value = true
  loading.value = true
  suggestions.value = []
  activeIndex.value = 0
  const currentRequest = ++request
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(async () => {
    try {
      const result = await searchReferenceSuggestions(trigger!, 10)
      if (currentRequest !== request) return
      suggestions.value = result
      visible.value = result.length > 0
    } catch {
      if (currentRequest === request) close()
    } finally {
      if (currentRequest === request) loading.value = false
    }
  }, 120)
}

function useControl(event: Event) {
  const control = event.target as HTMLInputElement | HTMLTextAreaElement
  controlRef.value = control
  schedule(control.value, control.selectionStart ?? control.value.length)
}

function handleInput(event: Event) {
  const control = event.target as HTMLInputElement | HTMLTextAreaElement
  currentValue.value = control.value
  emit('update:modelValue', control.value)
  useControl(event)
}

function handleCursorEvent(event: Event) {
  useControl(event)
}

async function insertTrigger() {
  const control = controlRef.value
    ?? rootRef.value?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  if (!control) return
  controlRef.value = control
  const result = insertReferenceTrigger(
    currentValue.value,
    control.selectionStart ?? currentValue.value.length,
    control.selectionEnd ?? control.selectionStart ?? currentValue.value.length,
  )
  currentValue.value = result.value
  emit('update:modelValue', result.value)
  await nextTick()
  control.value = result.value
  control.setSelectionRange(result.cursor, result.cursor)
  control.focus()
  schedule(result.value, result.cursor)
}

async function applySuggestion(suggestion: ReferenceSuggestion) {
  const control = controlRef.value
  if (!control || !trigger) return
  const value = control.value
  const cursor = control.selectionStart ?? value.length
  const token = referenceTokenForSuggestion(suggestion)
  const next = `${value.slice(0, trigger.start)}${token}${value.slice(cursor)}`
  const nextCursor = trigger.start + token.length
  currentValue.value = next
  emit('update:modelValue', next)
  await nextTick()
  control.value = next
  control.setSelectionRange(nextCursor, nextCursor)
  control.focus()
  if (suggestion.kind === 'type') schedule(next, nextCursor)
  else close()
}

watch(() => props.modelValue, value => { currentValue.value = value })

function handleKeydown(event: KeyboardEvent) {
  if (!visible.value || suggestions.value.length === 0) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    void applySuggestion(suggestions.value[activeIndex.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  if (debounce) clearTimeout(debounce)
})
</script>

<style scoped>
.p-reference-field { position: relative; min-width: 0; }
.p-reference-field__trigger { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-left: 1px solid var(--a-color-border-soft); background: transparent; color: var(--a-color-text-secondary); cursor: pointer; }
.p-reference-field__trigger:hover { color: var(--a-color-text); }
.p-reference-field__trigger:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: -3px; }
.p-reference-field__trigger:disabled { cursor: not-allowed; opacity: 0.5; }
</style>
