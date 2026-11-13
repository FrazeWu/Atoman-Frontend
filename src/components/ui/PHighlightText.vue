<template>
  <template v-if="!query?.trim()">{{ text }}</template>
  <template v-else>
    <template v-for="(seg, idx) in segments" :key="idx">
      <mark v-if="seg.match" class="p-highlight-match">{{ seg.text }}</mark>
      <template v-else>{{ seg.text }}</template>
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { highlightSegments } from '@/utils/textHighlight'

const props = withDefaults(
  defineProps<{
    text: string
    query?: string
  }>(),
  {
    query: '',
  },
)

const segments = computed(() => highlightSegments(props.text, props.query))
</script>

<style scoped>
.p-highlight-match {
  background-color: var(--a-color-highlight-bg, rgba(234, 179, 8, 0.28));
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
