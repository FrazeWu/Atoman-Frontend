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
  border: 1px solid var(--a-color-ink);
  border-radius: var(--a-radius-none, 0px);
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  cursor: pointer;
  font-family: inherit;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.08em;
  line-height: 1;
  text-decoration: none;
  text-transform: uppercase;
  transition: transform 0.1s ease, background-color 0.1s ease, border-color 0.1s ease;
  white-space: nowrap;
}

.p-button-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
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
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
}

.p-button--secondary {
  border: 0;
  border-bottom: 2px solid var(--a-color-line);
  background: transparent;
  color: var(--a-color-ink-soft);
}

.p-button--secondary:hover:not(.p-button--disabled) {
  background: #f4ece1;
  color: #6b4f3a;
  border-bottom-color: #6b4f3a;
}

.p-button--ghost {
  border-color: transparent;
  background: transparent;
  color: var(--a-color-ink);
}

.p-button--danger {
  border-color: var(--a-color-danger-line);
  background: var(--a-color-paper);
  color: var(--a-color-danger-ink);
}

.p-button--danger:hover:not(.p-button--disabled) {
  background: var(--a-color-danger-bg);
  border-color: var(--a-color-danger-line);
}

.p-button--block {
  width: 100%;
}

.p-button:not(.p-button--disabled):active {
  transform: translateY(1px);
}

.p-button--disabled {
  cursor: not-allowed;
  opacity: 0.5;
  text-decoration: line-through;
}

@media (max-width: 767px) {
  .p-button--sm {
    min-height: 44px;
    font-size: 12px;
  }
}
</style>
