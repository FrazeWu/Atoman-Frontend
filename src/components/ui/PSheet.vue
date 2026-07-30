<template>
  <Teleport to="body" :disabled="isTest">
    <div class="p-sheet-root" :class="{ 'p-sheet-root--above-player': abovePlayer }">
      <!-- Backdrop to catch clicks outside the sheet -->
      <Transition name="fade">
        <div v-if="show && showBackdrop && isTopLayer" class="p-sheet-backdrop" :style="{ top: top }" @click="$emit('close')" />
      </Transition>

      <Transition :name="transitionName">
        <div
          v-if="show"
          ref="panelRef"
          class="p-sheet-layer p-sheet-panel"
          :class="[`is-${side}`, panelClass, { 'is-shifted': isShifted }]"
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

          <button
            v-if="showHeaderClose"
            ref="closeButtonRef"
            class="sheet-close-btn-floating"
            type="button"
            :aria-label="`关闭${title}`"
            :title="`关闭${title}`"
            @click="$emit('close')"
          >
            <X :size="20" aria-hidden="true" />
          </button>

          <div class="sheet-content hide-scrollbar" :class="{ 'sheet-content--compact': !hasHeader }">
            <div :class="{ 'sheet-content-inner': readingMode }">
              <div v-if="slots.header || title" class="sheet-content-header-inline">
                <slot name="header">
                  <span class="sheet-title-inline">{{ title }}</span>
                </slot>
              </div>
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
  height?: string
  panelClass?: string
  top?: string
  side?: 'left' | 'right' | 'bottom'
  closeType?: 'bookmark' | 'header' | 'both'
  readingMode?: boolean // If true, adds 720px max-width to content
  isShifted?: boolean
  isTopLayer?: boolean
  layerIndex?: number
  stackSize?: number
  index?: number
  showBackdrop?: boolean
  abovePlayer?: boolean
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
  stackSize: 1,
  showBackdrop: true,
  abovePlayer: false,
})

defineEmits(['close'])

const slots = useSlots()
const panelRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

watch(
  () => [props.show, props.isTopLayer] as const,
  async ([show, isTopLayer]) => {
    if (!show || !isTopLayer) return
    await nextTick()
    if (closeButtonRef.value) {
      closeButtonRef.value.focus()
    } else {
      panelRef.value?.focus()
    }
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
  return `calc(var(--a-sidebar-width) + ${32 + (sheetIndex.value * 32)}px)`
})

const computedWidth = computed(() => {
  return `calc(100% - var(--a-sidebar-width) - ${32 + (sheetIndex.value * 32)}px)`
})

const computedHandleTop = computed(() => {
  return `${32 + (sheetIndex.value * 56)}px`
})

const hasCustomWidth = computed(() => props.width && props.width !== 'min(100%, 480px)')
const sheetShift = computed(() => (
  hasCustomWidth.value ? Math.max(0, props.stackSize - props.layerIndex - 1) * 32 : 0
))
const sheetStackEdge = computed(() => Math.max(0, props.stackSize - 1) * 32)

const sheetStyle = computed(() => {
  if (props.side === 'bottom') {
    return {
      width: '100%',
      'max-width': '100%',
      height: props.height,
      left: 0,
      right: 0,
      top: 'auto',
      '--a-sheet-shift': `${sheetShift.value}px`,
    }
  }

  if (hasCustomWidth.value) {
    return {
      width: props.width,
      'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 16px - var(--a-sheet-stack-edge))',
      top: props.top,
      right: 0,
      '--a-sheet-shift': `${sheetShift.value}px`,
      '--a-sheet-stack-edge': `${sheetStackEdge.value}px`,
    }
  }
  return {
    width: computedWidth.value,
    'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 16px)',
    top: props.top,
    left: computedLeft.value,
    right: 0,
    '--a-sheet-shift': `${sheetShift.value}px`,
  }
})
</script>

<style scoped>
.p-sheet-panel {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.p-sheet-panel.is-shifted {
  transform: translateX(calc(-1 * var(--a-sheet-shift, 0px)));
  opacity: 0.6;
  pointer-events: none;
}

.p-sheet-layer {
  position: fixed;
  bottom: var(--a-content-bottom-offset);
  background: color-mix(in srgb, var(--a-color-bg) 85%, transparent);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  display: flex;
  flex-direction: column;
  z-index: var(--a-z-sheet);
}

.p-sheet-layer.is-right {
  right: 0;
  border-left: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

.p-sheet-layer.is-left {
  left: 0;
  border-right: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

.p-sheet-layer.is-bottom {
  left: 0;
  right: 0;
  top: auto;
  border-top: 1px solid var(--a-color-border-soft);
  box-shadow: none;
}

.p-sheet-backdrop {
  position: fixed;
  left: var(--a-sidebar-width);
  right: 0;
  bottom: var(--a-content-bottom-offset);
  background: transparent;
  z-index: var(--a-z-sheet-backdrop);
  cursor: default;
}

.p-sheet-root--above-player .p-sheet-layer {
  z-index: var(--a-z-player-sheet);
}

.p-sheet-root--above-player .p-sheet-backdrop {
  z-index: var(--a-z-player-sheet-backdrop);
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

.sheet-close-btn-floating {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0.5rem;
  line-height: 1;
  z-index: 1002;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, opacity 0.2s;
  opacity: 0.6;
}

.sheet-close-btn-floating:hover {
  opacity: 1;
  color: var(--a-color-fg);
}

.sheet-content-header-inline {
  margin-bottom: 2rem;
  padding-right: 3rem; /* Leave room for floating close button */
}

.sheet-title-inline {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--a-color-fg);
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

@media (max-width: 767px) {
  .p-sheet-backdrop {
    left: 0;
  }

  .p-sheet-layer {
    width: 100% !important;
    max-width: 100% !important;
    left: 0 !important;
  }

  .p-sheet-panel.is-shifted {
    visibility: hidden;
    transform: none;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .p-sheet-panel,
  .fade-enter-active,
  .fade-leave-active {
    transition-duration: 0.01ms;
  }
}

.slide-right-enter-active,
.slide-left-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, box-shadow 0.35s;
}

.slide-right-leave-active,
.slide-left-leave-active {
  transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.25s ease-in, box-shadow 0.25s;
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

.slide-up-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out, box-shadow 0.35s;
}

.slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.25s ease-in, box-shadow 0.25s;
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
