<template>
  <div 
    ref="containerRef" 
    class="p-segmented-control"
    :class="{ 'p-segmented-control--disabled': disabled }"
    role="radiogroup"
  >
    <!-- Sliding background indicator -->
    <div 
      class="p-segmented-control-indicator"
      :style="indicatorStyle"
    />

    <!-- Options -->
    <button
      v-for="option in options"
      :key="String(option.value)"
      :ref="el => setRef(option.value, el)"
      type="button"
      class="p-segmented-control-item p-tab"
      :class="{ 
        'p-segmented-control-item--active': modelValue === option.value,
        'p-tab--active': modelValue === option.value 
      }"
      :disabled="disabled"
      role="radio"
      :aria-checked="modelValue === option.value"
      :data-testid="option.testid || option['data-testid'] || (option.value ? 'mode-' + option.value : undefined)"
      :data-test="option.test || option['data-test'] || option.testid || option['data-testid']"
      @click="selectOption(option.value)"
    >
      <slot name="label" :option="option" :active="modelValue === option.value">
        <span class="p-segmented-control-label"> {{ option.label }} </span>
      </slot>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { ref, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'

interface Option<V> {
  label: string
  value: V
  [key: string]: any
}

const props = withDefaults(defineProps<{
  modelValue: T
  options: Option<T>[]
  disabled?: boolean
}>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: T]
  'change': [value: T]
}>()

const containerRef = ref<HTMLElement | null>(null)
const itemRefs = new Map<T, HTMLButtonElement>()

const setRef = (value: T, el: any) => {
  if (el) {
    itemRefs.set(value, el as HTMLButtonElement)
  } else {
    itemRefs.delete(value)
  }
}

const indicatorStyle = ref({
  left: '0px',
  width: '0px',
  opacity: 0
})

function updateIndicator() {
  const container = containerRef.value
  const activeEl = itemRefs.get(props.modelValue)

  if (!container || !activeEl) {
    indicatorStyle.value = { left: '0px', width: '0px', opacity: 0 }
    return
  }

  const containerRect = container.getBoundingClientRect()
  const activeRect = activeEl.getBoundingClientRect()
  const borderOffset = container.clientLeft || 0

  indicatorStyle.value = {
    left: `${activeRect.left - containerRect.left - borderOffset}px`,
    width: `${activeRect.width}px`,
    opacity: 1
  }
}

function selectOption(value: T) {
  if (props.disabled) return
  emit('update:modelValue', value)
  emit('change', value)
}

watch(() => props.modelValue, () => {
  nextTick(updateIndicator)
})

watch(() => props.options, () => {
  itemRefs.clear()
  nextTick(updateIndicator)
}, { deep: true })

let resizeObserver: any = null

onMounted(() => {
  nextTick(() => {
    updateIndicator()
  })
  
  if (typeof window !== 'undefined') {
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        updateIndicator()
      })
      resizeObserver.observe(containerRef.value)
      
      containerRef.value.querySelectorAll('.p-segmented-control-item').forEach(el => {
        resizeObserver?.observe(el)
      })
    } else {
      window.addEventListener('resize', updateIndicator)
    }
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIndicator)
  }
})
</script>

<style scoped>
.p-segmented-control {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 3px;
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-ink);
  box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.15);
  user-select: none;
}

.p-segmented-control--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.p-segmented-control-indicator {
  position: absolute;
  top: 3px;
  bottom: 3px;
  background: var(--a-color-ink);
  transition: left 0.25s cubic-bezier(0.25, 1, 0.5, 1), width 0.25s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease;
  z-index: 1;
}

.p-segmented-control-item {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 16px;
  border: none;
  background: transparent;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.2s ease;
}

.p-segmented-control-item:hover:not(:disabled) {
  color: var(--a-color-ink);
}

.p-segmented-control-item--active {
  color: var(--a-color-paper) !important;
}

.p-segmented-control-item:focus-visible {
  outline: none;
}
</style>
