<template>
  <component
    :is="componentTag"
    class="p-button"
    :class="buttonClass"
    v-bind="componentAttrs"
    @click="handleClick"
  >
    <span v-if="dot" class="p-button-dot" aria-hidden="true" />
    <slot>{{ computedLabel }}</slot>
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  tag?: string
  to?: RouteLocationRaw
  href?: string
  target?: string
  rel?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  outline?: boolean
  danger?: boolean
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  dot?: boolean
}>(), {
  tag: 'button',
  to: undefined,
  href: undefined,
  target: undefined,
  rel: undefined,
  label: '',
  variant: 'primary',
  outline: false,
  danger: false,
  size: 'md',
  block: false,
  disabled: false,
  loading: false,
  loadingText: '处理中...',
  dot: false,
})

const emit = defineEmits<{
  click: [MouseEvent]
}>()

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

const normalizedVariant = computed(() => {
  if (props.danger) return 'danger'
  if (props.outline) return 'secondary'
  return props.variant
})

const computedLabel = computed(() => props.loading ? props.loadingText : props.label)
const componentTag = computed(() => props.to ? RouterLink : (props.href ? 'a' : props.tag))
const isNativeButton = computed(() => !props.to && !props.href && props.tag === 'button')
const computedRel = computed(() => props.rel ?? (props.target === '_blank' ? 'noreferrer' : undefined))

const buttonClass = computed(() => ([
  `p-button--${normalizedVariant.value}`,
  `p-button--${props.size}`,
  {
    'p-button--block': props.block,
    'p-button--loading': props.loading,
    'p-button--disabled': props.disabled || props.loading,
  },
]))

const componentAttrs = computed(() => {
  const baseAttrs: Record<string, unknown> = { ...attrs }

  if (props.to) {
    baseAttrs.to = props.to
  } else if (props.href) {
    baseAttrs.href = props.href
    if (props.target) baseAttrs.target = props.target
    if (computedRel.value) baseAttrs.rel = computedRel.value
  } else if (isNativeButton.value) {
    baseAttrs.type = typeof attrs.type === 'string' ? attrs.type : 'button'
    baseAttrs.disabled = props.disabled || props.loading
  }

  if (!isNativeButton.value && (props.disabled || props.loading)) {
    baseAttrs['aria-disabled'] = 'true'
  }

  return baseAttrs
})

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  emit('click', event)
}
</script>

<style scoped>
.p-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
}

.p-button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.p-button-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-text) 72%, transparent);
  flex-shrink: 0;
}

.p-button--sm {
  min-height: 32px;
  padding: 0 14px;
  font-size: 10px;
}

.p-button--md {
  min-height: 40px;
  padding: 0 20px;
  font-size: 12px;
}

.p-button--lg {
  min-height: 48px;
  padding: 0 26px;
  font-size: 13px;
}

.p-button--primary {
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  border-color: var(--a-color-primary);
}

.p-button--primary:hover:not(.p-button--disabled) {
  background: var(--a-color-primary-hover);
  border-color: var(--a-color-primary-hover);
}

.p-button--primary:active:not(.p-button--disabled) {
  background: var(--a-color-primary-pressed);
  border-color: var(--a-color-primary-pressed);
}

.p-button--secondary {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  border-color: transparent;
}

.p-button--secondary:hover:not(.p-button--disabled) {
  background: var(--a-color-disabled-border);
  color: var(--a-color-text);
}

.p-button--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--a-color-text);
}

.p-button--ghost:hover:not(.p-button--disabled) {
  background: var(--a-color-surface);
}

.p-button--danger {
  border-color: var(--a-color-danger-border);
  background: var(--a-color-bg);
  color: var(--a-color-danger);
}

.p-button--danger:hover:not(.p-button--disabled) {
  background: var(--a-color-danger-bg);
  border-color: var(--a-color-danger-border);
}

.p-button--block {
  width: 100%;
}

.p-button:not(.p-button--disabled):active {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 18%, transparent);
}

.p-button--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 767px) {
  .p-button--sm,
  .p-button--md {
    min-height: 44px;
  }

  .p-button--sm {
    font-size: 12px;
  }
}
</style>
