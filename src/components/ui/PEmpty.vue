<template>
  <div
    class="p-empty"
    :class="[
      `p-empty--${align}`,
      { 'p-empty--compact': compact }
    ]"
  >
    <div v-if="$slots.icon" class="p-empty__icon">
      <slot name="icon" />
    </div>
    <p v-if="computedKicker" class="p-empty__kicker">{{ computedKicker }}</p>
    <h2 v-if="computedTitle" class="p-empty__title">{{ computedTitle }}</h2>
    <p v-if="computedDescription" class="p-empty__description">{{ computedDescription }}</p>
    <slot v-if="!computedTitle && !computedDescription" />
    <div v-if="$slots.action" class="p-empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  text?: string
  sub?: string
  message?: string
  kicker?: string
  align?: 'start' | 'center'
  compact?: boolean
}>(), {
  title: '',
  description: '',
  text: '',
  sub: '',
  message: '',
  kicker: '暂无内容',
  align: 'start',
  compact: false,
})

const computedTitle = computed(() => props.title || props.text || props.message)
const computedDescription = computed(() => props.description || props.sub || (props.title ? props.message : ''))
const computedKicker = computed(() => {
  if (!props.kicker || props.kicker === '暂无内容') return ''
  return (computedTitle.value || computedDescription.value) ? props.kicker : ''
})
</script>

<style scoped>
.p-empty {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 32px 0;
  width: 100%;
}

.p-empty--center {
  justify-items: center;
  text-align: center;
}

.p-empty--compact {
  padding: 16px 0;
  gap: 6px;
}

.p-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
  margin-bottom: 2px;
}

.p-empty__kicker,
.p-empty__title,
.p-empty__description {
  margin: 0;
}

.p-empty__kicker {
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.p-empty__title {
  color: var(--a-color-text);
  font-size: 1.0625rem;
  font-weight: 500;
  line-height: 1.4;
}

.p-empty__description {
  color: var(--a-color-muted);
  line-height: 1.5;
  font-size: 0.8125rem;
  max-width: 48ch;
}

.p-empty__action {
  margin-top: 6px;
}

@media (max-width: 767px) {
  .p-empty {
    padding: 24px 0;
  }
  .p-empty--compact {
    padding: 12px 0;
  }
}
</style>
