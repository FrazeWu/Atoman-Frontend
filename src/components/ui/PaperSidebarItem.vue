<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="a-sidebar-item"
    :class="{ 'is-focused': isFocused }"
    active-class="active"
    :exact-active-class="exact ? 'active' : ''"
  >
    <span v-if="index" class="a-sidebar-item-num">{{ formattedIndex }}</span>
    <span class="paper-sidebar-item-label"><slot /></span>
    <span
      v-if="icon || iconChar"
      class="paper-sidebar-item-icon"
      :class="{ 'is-component-icon': icon, 'is-char-icon': !icon && iconChar }"
      aria-hidden="true"
    >
      <component :is="icon" v-if="icon" class="paper-sidebar-item-svg" />
      <template v-else>{{ iconChar }}</template>
    </span>
  </RouterLink>
  <button
    v-else
    type="button"
    class="a-sidebar-item"
    :class="{ active, 'is-focused': isFocused }"
    @click="$emit('click')"
  >
    <span v-if="index" class="a-sidebar-item-num">{{ formattedIndex }}</span>
    <span class="paper-sidebar-item-label"><slot /></span>
    <span
      v-if="icon || iconChar"
      class="paper-sidebar-item-icon"
      :class="{ 'is-component-icon': icon, 'is-char-icon': !icon && iconChar }"
      aria-hidden="true"
    >
      <component :is="icon" v-if="icon" class="paper-sidebar-item-svg" />
      <template v-else>{{ iconChar }}</template>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'

const props = defineProps<{
  to?: string | object
  index?: number | string
  active?: boolean
  exact?: boolean
  icon?: Component
  iconChar?: string
  isFocused?: boolean
}>()

defineEmits(['click'])

const formattedIndex = computed(() => {
  if (typeof props.index === 'number') {
    return String(props.index).padStart(2, '0') + '/'
  }
  return props.index
})
</script>

<style scoped>
.a-sidebar-item {
  outline: none;
  border-radius: 0.875rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}
.a-sidebar-item:hover,
.a-sidebar-item.is-focused {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}
.a-sidebar-item.active {
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}
</style>
