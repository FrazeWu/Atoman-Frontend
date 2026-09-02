<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconChevronDown as ChevronDown } from '@tabler/icons-vue'

const props = withDefaults(defineProps<{
  description?: string
  emptyText?: string
  contentId: string
  testId: string
  maxWidth?: string
}>(), {
  description: '',
  emptyText: '',
  maxWidth: '44rem',
})

const descriptionElement = ref<HTMLElement | null>(null)
const expanded = ref(false)
const canExpand = ref(false)
const displayText = computed(() => props.description.trim() || props.emptyText)
let resizeObserver: ResizeObserver | null = null

function measureOverflow() {
  const element = descriptionElement.value
  if (!element || expanded.value) return
  canExpand.value = element.scrollHeight > element.clientHeight + 1
}

function observeDescription() {
  resizeObserver?.disconnect()
  if (!descriptionElement.value || typeof ResizeObserver === 'undefined') return

  resizeObserver = new ResizeObserver(() => {
    void nextTick(measureOverflow)
  })
  resizeObserver.observe(descriptionElement.value)
}

async function resetPreview() {
  expanded.value = false
  canExpand.value = false
  await nextTick()
  observeDescription()
  measureOverflow()
}

function togglePreview() {
  expanded.value = !expanded.value
  if (!expanded.value) void nextTick(measureOverflow)
}

watch(displayText, () => {
  void resetPreview()
})

onMounted(() => {
  window.addEventListener('resize', measureOverflow)
  void resetPreview()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measureOverflow)
})
</script>

<template>
  <section class="music-description-preview" :style="{ maxWidth }">
    <p class="music-description-preview__label">简介</p>
    <p
      :id="contentId"
      ref="descriptionElement"
      class="music-description-preview__content"
      :class="{ 'is-expanded': expanded }"
    >{{ displayText }}</p>
    <button
      v-if="canExpand"
      type="button"
      class="music-description-preview__toggle"
      :aria-controls="contentId"
      :aria-expanded="expanded"
      :data-testid="testId"
      @click="togglePreview"
    >
      <span>{{ expanded ? '收起' : '展开' }}</span>
      <ChevronDown :size="16" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
.music-description-preview {
  display: grid;
  width: 100%;
  gap: 0.35rem;
}

.music-description-preview__label,
.music-description-preview__content {
  margin: 0;
}

.music-description-preview__label {
  color: var(--a-color-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.music-description-preview__content {
  display: -webkit-box;
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.music-description-preview__content.is-expanded {
  display: block;
  overflow: visible;
}

.music-description-preview__toggle {
  display: inline-flex;
  align-items: center;
  width: max-content;
  min-height: 2.5rem;
  gap: 0.35rem;
  padding: 0.4rem 0;
  border: 0;
  background: transparent;
  color: var(--a-color-primary);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.music-description-preview__toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 3px;
}

.music-description-preview__toggle svg {
  transition: transform 0.18s ease;
}

.music-description-preview__toggle[aria-expanded="true"] svg {
  transform: rotate(180deg);
}
</style>
