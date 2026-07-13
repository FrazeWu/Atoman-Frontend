<template>
  <Teleport to="body" :disabled="isTest">
    <div class="p-sheet-root">
      <!-- Backdrop to catch clicks outside the sheet -->
      <Transition name="fade">
        <div v-if="show && showBackdrop && isTopLayer" class="p-sheet-backdrop" :style="{ top: top }" @click="$emit('close')" />
      </Transition>

      <Transition :name="transitionName">
        <div
          v-if="show"
          ref="panelRef"
          class="p-sheet-layer p-sheet-panel"
          :class="[`is-${side}`, { 'is-shifted': isShifted }]"
          :style="sheetStyle"
          role="dialog"
          :aria-modal="isTopLayer ? 'true' : undefined"
          :aria-label="title"
          :aria-hidden="isTopLayer ? undefined : 'true'"
          :inert="isTopLayer ? undefined : true"
          :data-layer-index="layerIndex"
          tabindex="-1"
          @keydown.esc="isTopLayer && $emit('close')"
        >
          <!-- Left/Right Edge Close Tab (Taped Component Style) -->
          <PSheetTab 
            v-if="showBookmarkTab"
            class="sheet-tab-position"
            :style="{ top: computedHandleTop }"
            :title="title" 
            @click="$emit('close')" 
          />

          <div v-if="hasHeader" class="sheet-header">
            <slot name="header">
              <span class="a-font-meta sheet-header-label">{{ title?.toUpperCase() }}</span>
            </slot>
            <button
              v-if="showHeaderClose"
              class="header-close-btn"
              type="button"
              :aria-label="`关闭${title}`"
              :title="`关闭${title}`"
              @click="$emit('close')"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>
          
          <div class="sheet-content hide-scrollbar" :class="{ 'sheet-content--compact': !hasHeader }">
            <div :class="{ 'sheet-content-inner': readingMode }">
              <slot />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useSlots, watch } from 'vue'
import { getActivePinia } from 'pinia'
import { X } from 'lucide-vue-next'
import { useSheetStore } from '@/stores/sheet'
import PSheetTab from './PSheetTab.vue'

const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  width?: string
  maxWidth?: string
  top?: string
  side?: 'left' | 'right' | 'bottom'
  closeType?: 'bookmark' | 'header' | 'both'
  readingMode?: boolean // If true, adds 720px max-width to content
  isShifted?: boolean
  isTopLayer?: boolean
  layerIndex?: number
  index?: number
  showBackdrop?: boolean
}>(), {
  title: 'VIEW',
  width: 'min(100%, 480px)',
  top: '56px',
  side: 'right',
  closeType: 'bookmark',
  readingMode: false,
  isShifted: false,
  isTopLayer: true,
  layerIndex: 0,
  showBackdrop: true,
})

defineEmits(['close'])

const slots = useSlots()
const panelRef = ref<HTMLElement | null>(null)

watch(
  () => [props.show, props.isTopLayer] as const,
  async ([show, isTopLayer]) => {
    if (!show || !isTopLayer) return
    await nextTick()
    panelRef.value?.focus()
  },
  { immediate: true },
)
const effectiveCloseType = computed(() => {
  if (props.side === 'bottom' && props.closeType === 'bookmark') {
    return 'header'
  }

  return props.closeType
})

const showBookmarkTab = computed(() => effectiveCloseType.value === 'bookmark' || effectiveCloseType.value === 'both')
const showHeaderClose = computed(() => effectiveCloseType.value === 'header' || effectiveCloseType.value === 'both')
const hasHeader = computed(() => Boolean(slots.header) || showHeaderClose.value)

const transitionName = computed(() => {
  if (props.side === 'left') return 'slide-left'
  if (props.side === 'bottom') return 'slide-up'
  return 'slide-right'
})

const sheetIndex = computed(() => {
  if (props.index !== undefined) {
    return props.index
  }
  if (getActivePinia()) {
    const sheetStore = useSheetStore()
    const idx = sheetStore.stack.findIndex(s => s.title === props.title)
    if (idx !== -1) {
      return idx
    }
  }
  return 0
})

const computedLeft = computed(() => {
  return `${32 + (sheetIndex.value * 32)}px`
})

const computedWidth = computed(() => {
  return `calc(100% - ${computedLeft.value})`
})

const computedHandleTop = computed(() => {
  return `${32 + (sheetIndex.value * 56)}px`
})

const sheetStyle = computed(() => {
  if (props.side === 'bottom') {
    return {
      width: '100%',
      'max-width': '100%',
      left: 0,
      right: 0,
      top: 'auto'
    }
  }

  const hasCustomWidth = props.width && props.width !== 'min(100%, 480px)'
  if (hasCustomWidth) {
    return {
      width: props.width,
      'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 16px)',
      top: props.top,
      right: 0
    }
  }
  return {
    width: computedWidth.value,
    'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 16px)',
    top: props.top,
    left: computedLeft.value,
    right: 0
  }
})
</script>

<style scoped>
.p-sheet-panel {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.p-sheet-panel.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.6;
  pointer-events: none;
}

.p-sheet-layer {
  position: fixed;
  bottom: 0;
  background: white;
  display: flex;
  flex-direction: column;
  z-index: 3000;
}

.p-sheet-layer.is-right {
  right: 0;
  border-left: 1px solid var(--a-color-line-soft);
  box-shadow: none;
}

.p-sheet-layer.is-left {
  left: 0;
  border-right: 1px solid var(--a-color-line-soft);
  box-shadow: none;
}

.p-sheet-layer.is-bottom {
  left: 0;
  right: 0;
  top: auto;
  border-top: 1px solid var(--a-color-line-soft);
  box-shadow: none;
}

.p-sheet-backdrop {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2999;
  cursor: default;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sheet-tab-position {
  position: absolute;
  top: 32px;
  z-index: 1001;
}

.is-right .sheet-tab-position {
  left: 0;
  transform: translateX(-100%);
}

.is-left .sheet-tab-position {
  right: 0;
  transform: translateX(100%) scaleX(-1);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2.5rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  background: white;
  color: black;
}

.sheet-header-label {
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--a-color-muted);
}

.header-close-btn {
  background: none;
  border: none;
  color: black;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  line-height: 1;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.header-close-btn:hover {
  opacity: 1;
}

.sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
}

.sheet-content--compact {
  padding-top: 1.5rem;
}

.sheet-content-inner {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  align-self: center;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.4s, opacity 0.4s;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  box-shadow: none;
  opacity: 0;
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
  box-shadow: none;
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.4s, opacity 0.4s;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  box-shadow: none;
  opacity: 0;
}

@media (max-width: 767px) {
  .p-sheet-layer {
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .p-sheet-panel.is-shifted {
    visibility: hidden;
  }
}

@media (prefers-reduced-motion: reduce) {
  .p-sheet-panel,
  .slide-right-enter-active,
  .slide-right-leave-active,
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: none;
  }
}
</style>
