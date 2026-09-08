<template>
  <article
    v-bind="$attrs"
    class="p-interaction-card"
    :class="`p-interaction-card--${props.variant}`"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    @click="handleActivate"
    @keydown.enter.prevent="handleActivate"
    @keydown.space.prevent="handleActivate"
  >
    <slot />
    <span v-if="interactive" class="p-interaction-card__arrow" aria-hidden="true">→</span>
  </article>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  variant?: 'default' | 'flat'
  interactive?: boolean
}>(), {
  variant: 'default',
  interactive: false,
})

const emit = defineEmits<{
  activate: []
}>()

function handleActivate() {
  if (props.interactive) emit('activate')
}
</script>

<style scoped>
.p-interaction-card {
  position: relative;
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.p-interaction-card[role='button'] {
  padding-right: 2.5rem;
}

.p-interaction-card__arrow {
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: var(--a-color-muted);
  font-size: 1rem;
  line-height: 1;
  transition: color 0.15s ease, transform 0.15s ease;
}

.p-interaction-card[role='button']:hover .p-interaction-card__arrow,
.p-interaction-card[role='button']:focus-visible .p-interaction-card__arrow {
  color: var(--a-color-primary-hover);
  transform: translateX(2px);
}

.p-interaction-card:focus {
  border-color: var(--a-color-primary);
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 20%, transparent);
  outline-offset: 2px;
}

.p-interaction-card--flat {
  padding: 0.85rem 0 0.25rem;
  border: 0;
  border-radius: 0;
  background: transparent;
}
</style>
