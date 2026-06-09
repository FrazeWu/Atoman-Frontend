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
    <span v-if="iconChar" class="paper-sidebar-item-icon" aria-hidden="true">{{ iconChar }}</span>
    <span class="paper-sidebar-item-label"><slot /></span>
  </RouterLink>
  <button
    v-else
    type="button"
    class="a-sidebar-item"
    :class="{ active, 'is-focused': isFocused }"
    @click="$emit('click')"
  >
    <span v-if="index" class="a-sidebar-item-num">{{ formattedIndex }}</span>
    <span v-if="iconChar" class="paper-sidebar-item-icon" aria-hidden="true">{{ iconChar }}</span>
    <span class="paper-sidebar-item-label"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  to?: string | object
  index?: number | string
  active?: boolean
  exact?: boolean
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
}
.a-sidebar-item.is-focused {
  background: var(--a-color-paper-wash);
  box-shadow: inset 4px 0 0 var(--a-color-ink);
}
</style>
