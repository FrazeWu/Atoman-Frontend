<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="p-sidebar-item"
    :class="{ 'is-focused': isFocused }"
    active-class="active"
    :exact-active-class="exact ? 'active' : ''"
  >
    <span
      v-if="icon || iconChar"
      class="p-sidebar-item-icon"
      :class="{ 'is-component-icon': icon, 'is-char-icon': !icon && iconChar }"
      aria-hidden="true"
    >
      <component :is="icon" v-if="icon" class="p-sidebar-item-svg" />
      <template v-else>{{ iconChar }}</template>
    </span>
    <span class="p-sidebar-item-label"><slot /></span>
  </RouterLink>
  <button
    v-else
    type="button"
    class="p-sidebar-item"
    :class="{ active, 'is-focused': isFocused }"
    @click="$emit('click')"
  >
    <span
      v-if="icon || iconChar"
      class="p-sidebar-item-icon"
      :class="{ 'is-component-icon': icon, 'is-char-icon': !icon && iconChar }"
      aria-hidden="true"
    >
      <component :is="icon" v-if="icon" class="p-sidebar-item-svg" />
      <template v-else>{{ iconChar }}</template>
    </span>
    <span class="p-sidebar-item-label"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  to?: string | object
  index?: number | string
  active?: boolean
  exact?: boolean
  icon?: Component
  iconChar?: string
  isFocused?: boolean
}>()

defineEmits(['click'])

</script>

<style scoped>
.p-sidebar-item {
  position: relative;
  border-radius: var(--a-radius-control);
  background: transparent;
  border: 1px solid transparent;
  box-shadow: none;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.p-sidebar-item:hover,
.p-sidebar-item.is-focused {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
  box-shadow: inset 3px 0 0 var(--a-color-text);
}
.p-sidebar-item:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: -2px;
  background: var(--a-color-surface-muted);
}
.p-sidebar-item.active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: transparent;
  border-radius: 2px;
  box-shadow: inset 3px 0 0 var(--a-color-text);
  font-weight: 650;
}
</style>
