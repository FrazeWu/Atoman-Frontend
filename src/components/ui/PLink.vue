<template>
  <component
    :is="componentType"
    class="p-link"
    :class="[`p-link--${variant}`, `p-link--${linkKind}`]"
    :to="isRouterLink ? resolvedTo : undefined"
    :href="isAnchor ? href : undefined"
    :target="isAnchor ? resolvedTarget : undefined"
    :rel="isAnchor ? computedRel : undefined"
    @click="emit('click', $event)"
  >
    <span class="p-link__label"><slot>{{ label }}</slot></span>
    <span class="p-link__arrow" aria-hidden="true">{{ linkKind === 'external' ? '↗' : '→' }}</span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  label?: string
  to?: RouteLocationRaw
  href?: string
  external?: boolean
  target?: string
  rel?: string
  variant?: 'inline' | 'surface' | 'nav'
}>(), {
  label: '',
  to: undefined,
  href: undefined,
  external: false,
  target: undefined,
  rel: undefined,
  variant: 'inline',
})

const emit = defineEmits<{
  click: [MouseEvent]
}>()

const isInternalHref = (value: string) => {
  const href = value.trim()
  if (!href) return false
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('./') || href.startsWith('../')) return true
  if (typeof window === 'undefined') return false
  try {
    return new URL(href, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

const hrefIsExternal = computed(() => Boolean(props.href) && !isInternalHref(props.href || ''))
const isExternal = computed(() => Boolean(props.external) || hrefIsExternal.value)
const linkKind = computed(() => (isExternal.value ? 'external' : 'internal'))
const isRouterLink = computed(() => Boolean(props.to) || (Boolean(props.href) && !isExternal.value))
const isAnchor = computed(() => Boolean(props.href) && !isRouterLink.value)
const componentType = computed(() => (isRouterLink.value ? RouterLink : 'a'))
const resolvedTo = computed(() => props.to ?? props.href)
const resolvedTarget = computed(() => (isExternal.value ? (props.target ?? '_blank') : props.target))
const computedRel = computed(() => {
  const rel = props.rel?.trim()
  if (!isExternal.value && resolvedTarget.value !== '_blank') return rel || undefined
  const tokens = new Set((rel || '').split(/\s+/).filter(Boolean))
  tokens.add('noopener')
  tokens.add('noreferrer')
  return Array.from(tokens).join(' ')
})
</script>

<style scoped>
.p-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--a-color-text);
  font-family: inherit;
  font-size: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition:
    color var(--a-motion-micro, 140ms) ease,
    background-color var(--a-motion-micro, 140ms) ease,
    border-color var(--a-motion-micro, 140ms) ease,
    box-shadow var(--a-motion-micro, 140ms) ease;
}

.p-link--inline {
  border-bottom: 1px solid currentColor;
}

.p-link--surface {
  width: 100%;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-bg);
}

.p-link--nav {
  min-height: var(--a-control-height-md, 2.5rem);
  padding: 0 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control, 4px);
}

.p-link--inline:hover,
.p-link--inline:focus-visible,
.p-link--surface:hover,
.p-link--surface:focus-visible,
.p-link--nav:hover,
.p-link--nav:focus-visible {
  border-bottom-color: var(--a-color-primary-hover);
  color: var(--a-color-primary-hover);
}

.p-link--surface:hover,
.p-link--surface:focus-visible,
.p-link--nav:hover,
.p-link--nav:focus-visible {
  border-color: var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.p-link:active {
  color: var(--a-color-primary-pressed);
}

.p-link__arrow {
  display: inline-block;
  flex: 0 0 auto;
  color: var(--a-color-muted);
  font-size: 0.9em;
  line-height: 1;
  transition: color var(--a-motion-micro, 140ms) ease, transform var(--a-motion-micro, 140ms) ease;
}

.p-link--inline:hover .p-link__arrow,
.p-link--inline:focus-visible .p-link__arrow,
.p-link--surface:hover .p-link__arrow,
.p-link--surface:focus-visible .p-link__arrow,
.p-link--nav:hover .p-link__arrow,
.p-link--nav:focus-visible .p-link__arrow {
  color: currentColor;
}

.p-link--internal:hover .p-link__arrow,
.p-link--internal:focus-visible .p-link__arrow {
  transform: translateX(2px);
}

.p-link--external:hover .p-link__arrow,
.p-link--external:focus-visible .p-link__arrow {
  transform: translate(2px, -2px);
}
</style>
