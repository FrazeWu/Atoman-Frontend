<template>
  <ASurface class="a-empty" tone="soft" :layer="1">
    <p v-if="computedKicker" class="a-empty__kicker">{{ computedKicker }}</p>
    <h2 v-if="computedTitle" class="a-empty__title">{{ computedTitle }}</h2>
    <p v-if="computedDescription" class="a-empty__description">{{ computedDescription }}</p>
    <slot v-if="!computedTitle && !computedDescription" />
    <div v-if="$slots.action" class="a-empty__action">
      <slot name="action" />
    </div>
  </ASurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ASurface from './ASurface.vue'

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
  kicker: 'Empty Sheet',
})

const computedTitle = computed(() => props.title || props.text || props.message)
const computedDescription = computed(() => props.description || props.sub || (props.title ? props.message : ''))
const computedKicker = computed(() => (computedTitle.value || computedDescription.value) ? props.kicker : '')
</script>

<style scoped>
.a-empty {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding: 34px;
}

.a-empty__kicker,
.a-empty__title,
.a-empty__description {
  margin: 0;
}

.a-empty__kicker {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.a-empty__title {
  color: var(--a-color-ink);
  font-size: 22px;
  font-weight: 900;
}

.a-empty__description {
  color: var(--a-color-ink-muted);
  line-height: 1.7;
}

.a-empty__action {
  margin-top: 8px;
}
</style>
