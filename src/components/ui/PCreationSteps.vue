<template>
  <nav class="p-creation-steps" aria-label="创建进度">
    <ol class="p-creation-steps__list">
      <li
        v-for="step in steps"
        :key="step.value"
        class="p-creation-steps__item"
        :class="{
          'is-current': step.value === modelValue,
          'is-complete': step.value < modelValue,
        }"
      >
        <button
          type="button"
          class="p-creation-steps__button"
          :aria-current="step.value === modelValue ? 'step' : undefined"
          :aria-label="`第 ${step.value} 步：${step.label}`"
          :disabled="step.value > availableStep"
          @click="$emit('update:modelValue', step.value)"
        >
          <span class="p-creation-steps__number" aria-hidden="true">{{ step.value }}</span>
          <span class="p-creation-steps__content">
            <strong>{{ step.label }}</strong>
            <small v-if="step.description">{{ step.description }}</small>
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type CreationStep = {
  value: number
  label: string
  description?: string
}

const props = defineProps<{
  modelValue: number
  steps: CreationStep[]
  maxStep?: number
}>()

defineEmits<{
  'update:modelValue': [value: number]
}>()

const availableStep = computed(() => props.maxStep ?? props.modelValue)
</script>

<style scoped>
.p-creation-steps {
  width: 100%;
}

.p-creation-steps__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--a-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.p-creation-steps__item {
  min-width: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.p-creation-steps__item.is-current {
  border-bottom: 2px solid var(--a-color-text);
}

.p-creation-steps__button {
  display: flex;
  width: 100%;
  min-height: 56px;
  align-items: center;
  gap: var(--a-space-3);
  padding: var(--a-space-2) var(--a-space-1);
  border: 0;
  border-radius: var(--a-radius-control) var(--a-radius-control) 0 0;
  background: transparent;
  color: var(--a-color-text-secondary);
  text-align: left;
  cursor: pointer;
}

.p-creation-steps__button:hover:not(:disabled) {
  background: var(--a-color-surface-muted);
}

.p-creation-steps__button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.p-creation-steps__button:disabled {
  color: var(--a-color-muted);
  cursor: default;
}

.is-current .p-creation-steps__button,
.is-complete .p-creation-steps__button {
  color: var(--a-color-text);
}

.p-creation-steps__number {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border);
  border-radius: 50%;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.is-current .p-creation-steps__number {
  border-color: var(--a-color-text);
  background: var(--a-color-text);
  color: var(--a-color-bg);
}

.p-creation-steps__content {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.p-creation-steps__content strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.p-creation-steps__content small {
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .p-creation-steps__list {
    gap: 4px;
  }

  .p-creation-steps__button {
    min-height: 48px;
    justify-content: center;
    gap: 6px;
    padding-inline: 4px;
  }

  .p-creation-steps__number {
    width: 24px;
    height: 24px;
    flex-basis: 24px;
  }

  .p-creation-steps__content small {
    display: none;
  }
}
</style>
