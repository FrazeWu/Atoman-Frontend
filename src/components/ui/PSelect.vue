<template>
  <div class="p-field">
    <label v-if="label" class="p-field-label">{{ label }}</label>
    <div ref="rootRef" class="p-select-root">
      <button
        type="button"
        class="p-select-trigger"
        :class="[
          open ? 'p-select-trigger--open' : '',
          error ? 'p-select-trigger--error' : '',
        ]"
        :disabled="disabled"
        @click="toggleOpen"
      >
        <span :class="selectedOption ? '' : 'p-select-value--placeholder'">
          {{ selectedOption ? selectedOption.label : placeholder }}
        </span>
        <span class="p-select-chevron">▾</span>
      </button>

      <div v-if="open" class="p-select-panel">
        <button
          v-for="option in normalizedOptions"
          :key="String(option.value)"
          type="button"
          class="p-select-option"
          :disabled="option.disabled"
          @click="selectOption(option)"
        >
          <span class="p-select-marker">{{ option.value === modelValue ? '•' : '' }}</span>
          <span>{{ option.label }}</span>
        </button>
        <div v-if="normalizedOptions.length === 0" class="p-select-empty">暂无选项</div>
      </div>
    </div>
    <div v-if="error" class="p-field-error">{{ error }}</div>
    <div v-else-if="hint" class="p-field-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  options?: SelectOption[]
  placeholder?: string
  label?: string
  hint?: string
  error?: string
  disabled?: boolean
}>(), {
  modelValue: null,
  options: () => [],
  placeholder: '请选择',
  label: '',
  hint: '',
  error: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const normalizedOptions = computed(() => props.options ?? [])
const selectedOption = computed(() => normalizedOptions.value.find(option => option.value === props.modelValue))

const close = () => {
  open.value = false
}

const toggleOpen = () => {
  if (props.disabled) return
  open.value = !open.value
}

const selectOption = (option: SelectOption) => {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  close()
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) {
    close()
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>
