<template>
  <div
    v-if="hasContent"
    class="notification-context-quote"
    :class="{ 'notification-context-quote--expanded': expanded }"
    data-test="context-quote"
  >
    <div v-if="replyExcerpt" class="quote-line quote-line--reply">
      <span class="quote-prefix">回复：</span>
      <span class="quote-text">{{ replyExcerpt }}</span>
    </div>
    <div v-if="originalExcerpt" class="quote-line quote-line--original">
      <span class="quote-prefix">原内容：</span>
      <span class="quote-text">{{ originalExcerpt }}</span>
    </div>
    <div v-if="!replyExcerpt && !originalExcerpt && text" class="quote-line">
      <span class="quote-text">{{ text }}</span>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    replyExcerpt?: string
    originalExcerpt?: string
    text?: string
    expanded?: boolean
  }>(),
  {
    expanded: false,
  }
)

const slots = useSlots()

const hasContent = computed(() => {
  return Boolean(props.replyExcerpt || props.originalExcerpt || props.text || slots.default)
})
</script>

<style scoped>
.notification-context-quote {
  padding: 0.625rem 0.875rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-left: 3px solid var(--a-color-text);
  border-radius: var(--a-radius-card, 4px);
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.notification-context-quote:hover {
  background: color-mix(in srgb, var(--a-color-surface-muted) 85%, var(--a-color-border-soft));
  border-color: var(--a-color-border);
}

.quote-line {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.notification-context-quote--expanded .quote-line {
  display: block;
  -webkit-line-clamp: unset;
  overflow: visible;
}

.quote-line + .quote-line {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.quote-prefix {
  color: var(--a-color-text-muted);
  font-weight: 500;
}

.quote-text {
  color: var(--a-color-text);
}
</style>
