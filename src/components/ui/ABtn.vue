<template>
  <component
    :is="componentTag"
    class="a-btn"
    :class="buttonClass"
    v-bind="componentAttrs"
    @click="handleClick"
  >
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
  `a-btn--${normalizedVariant.value}`,
  `a-btn--${props.size}`,
  {
    'a-btn--block': props.block,
    'a-btn--loading': props.loading,
    'a-btn--disabled': props.disabled || props.loading,
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
.a-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px solid var(--a-color-ink);
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-weight: 950;
  letter-spacing: 0.12em;
  line-height: 1;
  text-decoration: none;
  text-transform: uppercase;
  transition: transform 0.14s ease, opacity 0.14s ease, box-shadow 0.14s ease;
  white-space: nowrap;
}

.a-btn::after {
  position: absolute;
  right: 7px;
  bottom: -7px;
  left: 7px;
  height: 7px;
  background: rgba(0, 0, 0, 0.16);
  content: '';
  filter: blur(0.4px);
}

.a-btn--sm {
  min-height: 32px;
  padding: 0 14px;
  font-size: 10px;
}

.a-btn--md {
  min-height: 40px;
  padding: 0 20px;
  font-size: 12px;
}

.a-btn--lg {
  min-height: 48px;
  padding: 0 26px;
  font-size: 13px;
}

.a-btn--primary {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
}

.a-btn--secondary {
  background: var(--a-color-paper);
  color: var(--a-color-ink);
}

.a-btn--ghost {
  border-color: transparent;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
}

.a-btn--ghost::after {
  display: none;
}

.a-btn--danger {
  border-color: var(--a-color-danger-line);
  background: var(--a-color-paper);
  color: var(--a-color-danger-ink);
  transform: rotate(-1deg);
}

.a-btn--block {
  width: 100%;
}

.a-btn:not(.a-btn--disabled):active {
  transform: translateY(3px);
}

.a-btn--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
