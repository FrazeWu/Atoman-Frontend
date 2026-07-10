<template>
  <component
    :is="componentType"
    class="p-link"
    :to="isRouterLink ? to : undefined"
    :href="isAnchor ? href : undefined"
    :target="target"
    :rel="computedRel"
    @click="emit('click', $event)"
  >
    <span class="p-link__label"><slot>{{ label }}</slot></span>
    <span class="p-link__arrow" aria-hidden="true">↗</span>
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
.p-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--a-color-ink);
  font-family: inherit;
  font-size: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s ease;
}

.p-link:hover,
.p-link:focus-visible {
  outline: none;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.p-link__arrow {
  font-size: 0.9em;
  display: inline-block;
  transition: transform 0.15s ease;
}

.p-link:hover .p-link__arrow,
.p-link:focus-visible .p-link__arrow {
  transform: translate(2px, -2px);
}
</style>
