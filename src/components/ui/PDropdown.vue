<template>
  <div ref="rootRef" class="p-dropdown-root">
    <div @click="toggleOpen">
      <slot name="trigger" :open="open">{{ label }}</slot>
    </div>
    <div
      v-if="open"
      class="p-dropdown-panel"
      :class="position === 'left' ? 'p-dropdown-panel--left' : 'p-dropdown-panel--right'"
    >
      <slot :close="close" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  position?: 'left' | 'right'
  closeOnClickOutside?: boolean
}>(), {
  label: 'Menu',
  position: 'right',
  closeOnClickOutside: true,
})

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const close = () => {
  open.value = false
}

const toggleOpen = () => {
  open.value = !open.value
}

const handleClickOutside = (event: MouseEvent) => {
  if (!props.closeOnClickOutside) return
  const target = event.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) {
    close()
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>
