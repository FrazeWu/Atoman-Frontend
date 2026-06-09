<template>
  <component
    :is="componentType"
    class="paper-link"
    :to="isRouterLink ? to : undefined"
    :href="isAnchor ? href : undefined"
    :target="target"
    :rel="computedRel"
    @click="emit('click', $event)"
  >
    <span class="paper-link__label"><slot>{{ label }}</slot></span>
    <span class="paper-link__arrow" aria-hidden="true">{{ external ? '↗' : '→' }}</span>
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
}>(), {
  label: '',
  to: undefined,
  href: undefined,
  external: false,
  target: undefined,
  rel: undefined,
})

const emit = defineEmits<{
  click: [MouseEvent]
}>()

const isRouterLink = computed(() => Boolean(props.to))
const isAnchor = computed(() => Boolean(props.href) && !props.to)
const componentType = computed(() => (isRouterLink.value ? RouterLink : 'a'))
const computedRel = computed(() => props.rel ?? (props.target === '_blank' || props.external ? 'noreferrer' : undefined))
</script>

<style scoped>
.paper-link {
  position: relative;
  display: inline-grid;
  grid-template-columns: 8px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0 9px;
  border-bottom: 1px solid var(--a-color-line);
  color: var(--a-color-ink);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-decoration: none;
  text-transform: uppercase;
}

.paper-link::before {
  width: 7px;
  height: 7px;
  background: var(--a-color-ink);
  content: '';
}

.paper-link:hover,
.paper-link:focus-visible {
  border-bottom-color: var(--a-color-ink);
  outline: none;
}

.paper-link__arrow {
  font-size: 17px;
  transition: transform 0.16s ease;
}

.paper-link:hover .paper-link__arrow,
.paper-link:focus-visible .paper-link__arrow {
  transform: translateX(4px);
}
</style>
