<template>
  <div
    class="m-input"
    :class="{
      'is-disabled': disabled,
      'is-focused': isFocused,
      'has-clear': clearable && modelValue.length > 0,
    }"
  >
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="m-input__field"
      @input="handleInput"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />
    <button
      v-if="clearable && modelValue.length > 0"
      type="button"
      class="m-input__clear"
      aria-label="清空输入"
      @click="handleClear"
    >
      <MIcon name="xmark" size="xs" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MIcon from './MIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    clearable?: boolean
    type?: string
    disabled?: boolean
  }>(),
  {
    placeholder: '',
    clearable: false,
    type: 'text',
    disabled: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const isFocused = ref(false)

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleClear() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.m-input {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 40px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  padding: 0 10px;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.m-input.is-focused {
  border-color: var(--a-color-border, #cbd5e1);
  box-shadow: 0 0 0 1px var(--a-color-border, #cbd5e1);
}

.m-input.is-disabled {
  background-color: var(--a-color-surface-muted, #f8fafc);
  opacity: 0.6;
  cursor: not-allowed;
}

.m-input__field {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 38px;
  border: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--a-color-text, #0f172a);
  outline: none;
  box-sizing: border-box;
}

.m-input__field::placeholder {
  color: var(--a-color-muted, #94a3b8);
}

.m-input__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--a-radius-control, 4px);
  border: none;
  background: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-muted, #64748b);
  cursor: pointer;
  padding: 0;
  margin-left: 6px;
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.m-input__clear:hover,
.m-input__clear:active {
  background-color: var(--a-color-border, #e2e8f0);
  color: var(--a-color-text, #0f172a);
}
</style>
