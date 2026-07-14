<template>
  <PSurface class="p-empty" tone="soft" :layer="1">
    <p v-if="computedKicker" class="p-empty__kicker">{{ computedKicker }}</p>
    <h2 v-if="computedTitle" class="p-empty__title">{{ computedTitle }}</h2>
    <p v-if="computedDescription" class="p-empty__description">{{ computedDescription }}</p>
    <slot v-if="!computedTitle && !computedDescription" />
    <div v-if="$slots.action" class="p-empty__action">
      <slot name="action" />
    </div>
  </PSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import PSurface from './PSurface.vue'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  text?: string
  sub?: string
  message?: string
  kicker?: string
}>(), {
  title: '',
  description: '',
  text: '',
  sub: '',
  message: '',
  kicker: '暂无内容',
})

const computedTitle = computed(() => props.title || props.text || props.message)
const computedDescription = computed(() => props.description || props.sub || (props.title ? props.message : ''))
const computedKicker = computed(() => (computedTitle.value || computedDescription.value) ? props.kicker : '')
</script>

<style scoped>
.p-empty {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding: 34px;
}

.p-empty__kicker,
.p-empty__title,
.p-empty__description {
  margin: 0;
}

.p-empty__kicker {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.p-empty__title {
  color: var(--a-color-ink);
  font-size: 22px;
  font-weight: 900;
}

.p-empty__description {
  color: var(--a-color-ink-muted);
  line-height: 1.7;
}

.p-empty__action {
  margin-top: 8px;
}
</style>
