<template>
  <Teleport to="body" :disabled="isTest">
    <div class="p-sheet-root" :class="{ 'p-sheet-root--above-player': abovePlayer }">
      <!-- Backdrop to catch clicks outside the sheet -->
      <Transition name="fade" appear>
        <div v-if="show && showBackdrop && isTopLayer" class="p-sheet-backdrop" :style="{ top: top }" @click="$emit('close')" />
      </Transition>

      <Transition :name="transitionName" appear>
        <div
          v-if="show"
          ref="panelRef"
          class="p-sheet-layer p-sheet-panel"
          :class="[`is-${side}`, panelClass, { 'is-shifted': isShifted }]"
          :style="sheetStyle"
          role="dialog"
          :aria-label="railTitle"
          :data-layer-index="effectiveLayerIndex"
          tabindex="-1"
          @keydown.esc="isTopLayer && $emit('close')"
        >
          <div v-if="showLayerRail" class="sheet-layer-rail">
            <div class="sheet-layer-controls">
              <button
                ref="closeButtonRef"
                class="sheet-close-btn-bookmark"
                type="button"
                :aria-label="closeLabel"
                :title="closeLabel"
                @click="$emit('close')"
              >
                <X :size="20" aria-hidden="true" />
              </button>

              <button
                v-if="!isTopLayer"
                class="sheet-layer-title sheet-layer-title--action"
                type="button"
                :aria-label="`返回${railTitle}`"
                :title="`返回${railTitle}`"
                @click="$emit('activate')"
              >
                <span>{{ railTitle }}</span>
              </button>
              <span v-else class="sheet-layer-title" :title="railTitle" aria-hidden="true">
                <span>{{ railTitle }}</span>
              </span>
            </div>
          </div>

          <button
            v-else-if="showBookmarkTab"
            ref="closeButtonRef"
            class="sheet-close-btn-bookmark sheet-close-btn-bookmark--legacy"
            type="button"
            :aria-label="closeLabel"
            :title="closeLabel"
            @click="$emit('close')"
          >
            <X :size="20" aria-hidden="true" />
          </button>

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

          <div
            class="sheet-content hide-scrollbar"
            :class="{
              'sheet-content--compact': !hasHeader,
              'sheet-content--has-close': showHeaderClose,
              'sheet-content--has-bookmark-close': showLayerRail || showBookmarkTab,
            }"
            :aria-hidden="isTopLayer ? undefined : 'true'"
            :inert="isTopLayer ? undefined : true"
          >
            <div
              :class="{ 'sheet-content-inner': readingMode || contentMaxWidth }"
              :style="contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined"
            >
              <div v-if="slots.header" class="sheet-content-header-inline">
                <slot name="header" />
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
import { computed, inject, nextTick, provide, ref, useSlots, watch } from 'vue'
import { getActivePinia } from 'pinia'
import { X } from 'lucide-vue-next'
import { useSheetStore } from '@/stores/sheet'

const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  ariaLabel?: string
  width?: string
  maxWidth?: string
  height?: string
  panelClass?: string
  top?: string
  side?: 'left' | 'right' | 'bottom'
  closeType?: 'bookmark' | 'header' | 'both'
  readingMode?: boolean // If true, adds 720px max-width to content
  contentMaxWidth?: string
  isShifted?: boolean
  isTopLayer?: boolean
  layerIndex?: number
  stackSize?: number
  index?: number
  showBackdrop?: boolean
  abovePlayer?: boolean
}>(), {
  title: '',
  width: 'min(100%, 480px)',
  top: '56px',
  side: 'right',
  closeType: 'bookmark',
  readingMode: false,
  contentMaxWidth: '',
  isShifted: false,
  isTopLayer: true,
  stackSize: 1,
  showBackdrop: true,
  abovePlayer: false,
})

defineEmits(['close', 'activate'])

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

const showLayerRail = computed(() => props.side === 'right')
const showBookmarkTab = computed(() => !showLayerRail.value && (effectiveCloseType.value === 'bookmark' || effectiveCloseType.value === 'both'))
const showHeaderClose = computed(() => !showLayerRail.value && (effectiveCloseType.value === 'header' || effectiveCloseType.value === 'both'))
const hasHeader = computed(() => Boolean(slots.header) || showHeaderClose.value)
const railTitle = computed(() => props.title || props.ariaLabel || '页面')
const closeLabel = computed(() => props.isTopLayer
  ? `关闭${railTitle.value}`
  : `关闭${railTitle.value}及上方页面`)

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

const parentLayerIndex = inject('p-sheet-layer-index', computed(() => -1))
const effectiveLayerIndex = computed(() => (
  props.layerIndex
  ?? props.index
  ?? (parentLayerIndex.value >= 0 ? parentLayerIndex.value + 1 : sheetIndex.value)
))
provide('p-sheet-layer-index', effectiveLayerIndex)
const layerInset = computed(() => effectiveLayerIndex.value * 32)
const layerTop = computed(() => `calc(${props.top} + ${effectiveLayerIndex.value * 4}px)`)

const sheetStyle = computed(() => {
  if (props.side === 'bottom') {
    return {
      width: '100%',
      'max-width': '100%',
      height: props.height,
      left: 0,
      right: 0,
      top: 'auto',
    }
  }

  if (props.side === 'right') {
    return {
      width: 'auto',
      'max-width': 'none',
      top: layerTop.value,
      left: `calc(var(--a-sidebar-width) + ${layerInset.value}px)`,
      right: 0,
    }
  }

  return {
    width: props.width,
    'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 16px)',
    top: layerTop.value,
    left: 0,
  }
})
</script>

<style scoped>
.p-sheet-panel {
  transition: left 200ms ease;
}

.p-sheet-panel.is-shifted {
  opacity: 1;
}

.p-sheet-panel.is-shifted .sheet-content {
  pointer-events: none;
}

.p-sheet-layer {
  position: fixed;
  bottom: var(--a-content-bottom-offset);
  background: #ffffff;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--a-color-border-soft);
  z-index: var(--a-z-sheet);
}

.p-sheet-layer.is-right {
  right: 0;
  border-left: 1px solid var(--a-color-border-soft);
  box-shadow: -8px 0 18px -16px rgba(0, 0, 0, 0.35);
}

.p-sheet-layer.is-left {
  left: 0;
  border-right: 1px solid var(--a-color-border-soft);
  box-shadow: 8px 0 18px -16px rgba(0, 0, 0, 0.35);
}

.p-sheet-layer.is-bottom {
  left: 0;
  right: 0;
  top: auto;
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

.sheet-layer-rail {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 1002;
  display: flex;
  width: 32px;
  flex-direction: column;
  align-items: center;
  background: #ffffff;
}

.sheet-layer-controls {
  display: flex;
  width: 44px;
  flex-direction: column;
  align-self: center;
  align-items: flex-start;
}

.sheet-close-btn-bookmark {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  margin-top: 1.5rem;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, opacity 0.2s;
  opacity: 0.6;
}

.sheet-close-btn-bookmark--legacy {
  position: absolute;
  top: 0;
  right: 1.5rem;
}

.sheet-close-btn-bookmark:hover {
  opacity: 1;
  color: var(--a-color-fg);
}

.sheet-layer-title {
  display: flex;
  min-height: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-start;
  width: 44px;
  margin: 0.25rem 0 1.25rem;
  padding: 0.5rem 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.4;
  letter-spacing: 0;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.sheet-layer-title > span {
  display: block;
  max-height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-layer-title--action {
  cursor: pointer;
}

.sheet-layer-title--action:hover,
.sheet-layer-title--action:focus-visible {
  color: var(--a-color-fg);
  outline: none;
}

.is-right .sheet-content--has-bookmark-close {
  padding-left: 6.5rem;
}

.is-left .sheet-content--has-bookmark-close {
  padding-right: 5rem;
}

.sheet-close-btn-floating {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 44px;
  height: 44px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0;
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

.sheet-content--has-close {
  padding-right: 5rem;
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
    opacity: 1;
  }

  .sheet-layer-rail {
    right: auto;
    bottom: auto;
    width: 56px;
  }

  .sheet-layer-title {
    display: none;
  }

  .is-right .sheet-content--has-bookmark-close {
    padding-left: 1rem;
  }

  .p-sheet-panel.is-right .sheet-content,
  .p-sheet-panel.is-left .sheet-content {
    padding: 4rem 1rem 1rem;
  }

  .sheet-content--has-close {
    padding-top: 4.5rem;
  }
}

.slide-right-enter-active,
.slide-left-enter-active {
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-right-leave-active,
.slide-left-leave-active {
  transition: transform 220ms cubic-bezier(0.4, 0, 1, 1);
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

.slide-up-enter-active {
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-up-leave-active {
  transition: transform 220ms cubic-bezier(0.4, 0, 1, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
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
  .fade-enter-active,
  .fade-leave-active,
  .slide-right-enter-active,
  .slide-right-leave-active,
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-up-enter-active,
  .slide-up-leave-active {
    transition-duration: 100ms;
  }

  .slide-right-enter-from,
  .slide-right-leave-to,
  .slide-left-enter-from,
  .slide-left-leave-to,
  .slide-up-enter-from,
  .slide-up-leave-to {
    transform: none;
  }
}
</style>
