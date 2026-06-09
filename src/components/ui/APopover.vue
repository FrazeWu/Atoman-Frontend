<template>
  <div ref="rootRef" class="a-popover-root">
    <div @click="toggleOpen">
      <slot name="trigger" :open="open">{{ label }}</slot>
    </div>
    <div
      v-if="open"
      class="a-popover-panel"
      :class="position === 'left' ? 'a-popover-panel--left' : 'a-popover-panel--right'"
    >
      <div class="a-popover-content">
        <slot :close="close" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(defineProps<{
  label?: string
  position?: 'left' | 'right'
  closeOnClickOutside?: boolean
}>(), {
  label: 'More',
  position: 'right',
  closeOnClickOutside: true,
})

const props = defineProps<{
  label?: string
  position?: 'left' | 'right'
  closeOnClickOutside?: boolean
}>()

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
