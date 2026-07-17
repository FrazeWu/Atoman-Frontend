<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label">
      <span class="p-field-dot" aria-hidden="true" />
      {{ label }}
    </label>
    <div class="p-textarea-wrapper">
      <textarea
        ref="textareaRef"
        class="p-textarea"
        :class="error ? 'p-textarea--error' : ''"
        v-bind="$attrs"
        :value="modelValue"
        :rows="rows"
        :disabled="disabled"
        :style="textareaStyle"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keyup="updateActiveLine"
        @click="updateActiveLine"
        @mouseup="updateActiveLine"
      />
      <div ref="mirrorRef" class="p-textarea-mirror" aria-hidden="true"></div>
    </div>
    <div v-if="error" class="p-field-error">{{ error }}</div>
    <div v-else-if="hint" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
  rows?: number
}>(), {
  modelValue: '',
  label: '',
  hint: '',
  error: '',
  disabled: false,
  rows: 4,
})

const emit = defineEmits<{
  'update:modelValue': [string]
  input: [Event]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mirrorRef = ref<HTMLElement | null>(null)
const currentLine = ref(0)
const isFocused = ref(false)

const textareaStyle = computed(() => ({
  '--current-line': currentLine.value,
  '--active-line-color': isFocused.value ? 'var(--a-color-ink)' : 'transparent'
}))

const updateActiveLine = () => {
  if (!textareaRef.value) return
  // wait for the selection to actually update after click/keypress
  nextTick(() => {
    if (!textareaRef.value || !mirrorRef.value) return
    const textarea = textareaRef.value
    const mirror = mirrorRef.value

    const textBeforeCursor = textarea.value.slice(0, textarea.selectionStart)

    // Sync width so text wrapping aligns perfectly with the textarea
    mirror.style.width = textarea.clientWidth + 'px'

    // Copy the text up to the cursor
    mirror.textContent = textBeforeCursor

    // Append a marker span to find the visual position
    const span = document.createElement('span')
    span.textContent = '|'
    mirror.appendChild(span)

    // Calculate the visual line by dividing the marker's Y position by the line height
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 32
    currentLine.value = Math.round(span.offsetTop / lineHeight)
  })
}

const handleInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  emit('input', event)
  updateActiveLine()
}

const handleFocus = () => {
  isFocused.value = true
  updateActiveLine()
}

const handleBlur = () => {
  isFocused.value = false
}

watch(() => props.modelValue, () => {
  nextTick(updateActiveLine)
}, { immediate: true })
</script>

<style scoped>
.p-field {
  display: grid;
  gap: 0.5rem;
}

.p-field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.p-field-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  flex-shrink: 0;
}

.p-textarea-wrapper {
  position: relative;
  width: 100%;
}

.p-textarea-mirror {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  visibility: hidden;
  pointer-events: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font: inherit;
  line-height: 2rem;
  padding: 0 4px;
  box-sizing: border-box;
  border: 0;
  z-index: -1;
}

.p-textarea {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--a-color-ink);

  /* Ruled lines setup */
  background-image:
    linear-gradient(to bottom, transparent 95%, var(--active-line-color, transparent) 95%),
    linear-gradient(to bottom, transparent 96%, var(--a-color-line) 96%);
  background-size:
    100% 2rem,
    100% 2rem;
  background-repeat:
    no-repeat,
    repeat;
  background-position:
    0 calc(var(--current-line, 0) * 2rem),
    0 0;
  background-attachment:
    local,
    local;

  font: inherit;
  line-height: 2rem;
  padding: 0 4px;
  resize: vertical;
  box-sizing: border-box;
  transition: background-position 0.08s ease;
}

.p-textarea:focus {
  outline: none;
}

.p-textarea--error {
  background-image:
    linear-gradient(to bottom, transparent 95%, var(--a-color-accent-destructive) 95%),
    linear-gradient(to bottom, transparent 96%, var(--a-color-line) 96%);
}

.p-field-error {
  color: var(--a-color-accent-destructive);
  font-size: 0.75rem;
}

.p-field-hint {
  color: var(--a-color-ink-soft);
  font-size: 0.75rem;
}
</style>
