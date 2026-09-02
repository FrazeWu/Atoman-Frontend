<template>
  <Transition :name="transitionName" appear>
    <section
      v-if="isMobile && show"
      class="p-sheet-mobile-page"
      :class="panelClass"
      role="region"
      :aria-label="railTitle"
    >
      <header v-if="title || slots.header" class="p-sheet-mobile-page__header">
        <button type="button" class="p-sheet-mobile-page__back" :aria-label="closeLabel" @click="$emit('close')">
          <ChevronLeft :size="20" aria-hidden="true" />
          <span>返回</span>
        </button>
        <h1 v-if="title">{{ title }}</h1>
        <slot name="header" />
      </header>
      <div class="p-sheet-mobile-page__content">
        <slot />
      </div>
    </section>
  </Transition>

  <Teleport v-if="!isMobile" to="body" :disabled="isTest || !teleport">
    <div
      class="p-sheet-root"
      :class="{
        'p-sheet-root--above-player': abovePlayer,
        'p-sheet-root--partial': isPartial,
      }"
    >
      <!-- Backdrop to catch clicks outside the sheet -->
      <Transition name="fade" appear>
        <div v-if="show && showBackdrop && isTopLayer && !isPartial" class="p-sheet-backdrop" :style="{ top: top }" @click="$emit('close')" />
      </Transition>

      <Transition :name="transitionName" appear>
        <div
          v-if="show"
          ref="panelRef"
          class="p-sheet-layer p-sheet-panel"
          :class="[
            `is-${side}`,
            panelClass,
            {
              'is-shifted': isShifted,
              'is-partial': isPartial,
              'is-partial-pending': partialRequested && !partialResolved,
            },
          ]"
          :style="sheetStyle"
          role="dialog"
          :aria-label="railTitle"
          :data-layer-index="effectiveLayerIndex"
          tabindex="-1"
          @keydown="handlePanelKeydown"
          @wheel="handleLayerWheel"
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
              data-p-sheet-content
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
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, useSlots, watch } from 'vue'
import { getActivePinia } from 'pinia'
import { X, ChevronLeft } from 'lucide-vue-next'
import { isStandaloneMobileApp } from '@/utils/appRuntime'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useSheetStore } from '@/stores/sheet'

const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')

const isMobile = computed(isStandaloneMobileApp)

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  ariaLabel?: string
  mode?: 'full' | 'partial'
  partialAnchor?: HTMLElement | null
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
  teleport?: boolean
  focusOnOpen?: boolean
}>(), {
  title: '',
  mode: 'full',
  partialAnchor: null,
  width: '100%',
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
  teleport: true,
  focusOnOpen: true,
})

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'activate'): void
  (event: 'mode-change', mode: 'full' | 'partial'): void
}>()

const slots = useSlots()
const panelRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const partialRequested = computed(() => (
  props.show && props.mode === 'partial' && props.side === 'right' && !isMobile.value
))
const partialResolved = ref(false)
const partialBounds = ref<{ top: string, right: string, bottom: string, left: string } | null>(null)
const isPartial = computed(() => partialRequested.value && partialResolved.value && partialBounds.value !== null)
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

const focusManagementOpen = computed(() => (
  props.show
  && props.isTopLayer
  && !isMobile.value
  && props.focusOnOpen
  && (!partialRequested.value || (partialResolved.value && !isPartial.value))
))
const { handleKeydown } = useDialogFocus(focusManagementOpen, panelRef, () => emit('close'))
const handlePanelKeydown = (event: KeyboardEvent) => {
  if (!props.isTopLayer) return
  if (focusManagementOpen.value) {
    handleKeydown(event)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

const handleLayerWheel = (event: WheelEvent) => {
  if (!props.isTopLayer) {
    event.preventDefault()
  }
}

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

let partialResizeObserver: ResizeObserver | undefined

const disconnectPartialObserver = () => {
  partialResizeObserver?.disconnect()
  partialResizeObserver = undefined
}

const updatePartialBounds = () => {
  disconnectPartialObserver()
  partialBounds.value = null
  partialResolved.value = false

  if (!partialRequested.value || typeof window === 'undefined') {
    partialResolved.value = true
    return
  }

  const parentLayerIndex = effectiveLayerIndex.value - 1
  const parentPanel = props.partialAnchor
    ? undefined
    : document.querySelector<HTMLElement>(
      `.p-sheet-panel[data-layer-index="${parentLayerIndex}"]`,
    )
  const parentContent = parentPanel?.querySelector<HTMLElement>('[data-p-sheet-content]')
  const contentAnchor = props.partialAnchor ?? parentContent
  if (!contentAnchor) {
    partialResolved.value = true
    emit('mode-change', 'full')
    return
  }

  const contentRect = contentAnchor.getBoundingClientRect()
  const panelRect = parentPanel?.getBoundingClientRect()
  const containerLeft = panelRect?.left ?? contentRect.left
  const containerRight = panelRect?.right ?? window.innerWidth
  const containerWidth = Math.max(0, containerRight - containerLeft)
  const gutterWidth = containerWidth * 0.04
  const availableWidth = Math.max(0, containerRight - contentRect.right - gutterWidth)
  const availableRatio = containerWidth ? availableWidth / containerWidth : 0
  if (availableRatio < 0.2) {
    partialResolved.value = true
    emit('mode-change', 'full')
    return
  }

  partialBounds.value = {
    top: panelRect ? `${panelRect.top}px` : props.top,
    right: `${window.innerWidth - containerRight}px`,
    bottom: panelRect ? `${window.innerHeight - panelRect.bottom}px` : 'var(--a-content-bottom-offset)',
    left: `${contentRect.right + gutterWidth}px`,
  }
  partialResolved.value = true
  emit('mode-change', 'partial')

  if (typeof ResizeObserver !== 'undefined') {
    partialResizeObserver = new ResizeObserver(updatePartialBounds)
    partialResizeObserver.observe(contentAnchor)
    if (parentPanel) partialResizeObserver.observe(parentPanel)
  }
}

const handlePartialEscape = (event: KeyboardEvent) => {
  if (!isPartial.value || !props.isTopLayer || event.defaultPrevented || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}

watch(
  [partialRequested, effectiveLayerIndex, () => props.partialAnchor],
  () => {
    void nextTick(updatePartialBounds)
  },
  { immediate: true, flush: 'post' },
)

onMounted(() => {
  window.addEventListener('keydown', handlePartialEscape, true)
  void nextTick(updatePartialBounds)
})

onBeforeUnmount(() => {
  disconnectPartialObserver()
  window.removeEventListener('keydown', handlePartialEscape, true)
})

const layerInset = computed(() => effectiveLayerIndex.value * 32)
const layerTop = computed(() => `calc(${props.top} + ${effectiveLayerIndex.value * 4}px)`)

const layerZIndex = computed(() => {
  const base = props.abovePlayer ? '--a-z-player-sheet' : '--a-z-sheet'
  return `calc(var(${base}) + ${effectiveLayerIndex.value})`
})

const sheetStyle = computed(() => {
  if (isPartial.value && partialBounds.value) {
    return {
      ...partialBounds.value,
      width: 'auto',
      'max-width': 'none',
      'z-index': layerZIndex.value,
    }
  }

  if (props.side === 'bottom') {
    return {
      width: '100%',
      'max-width': '100%',
      height: props.height,
      left: 0,
      right: 0,
      'z-index': layerZIndex.value,
    }
  }

  if (props.side === 'right') {
    return {
      width: 'auto',
      'max-width': 'none',
      top: layerTop.value,
      left: `calc(var(--a-sidebar-width) + ${layerInset.value}px)`,
      right: 0,
      'z-index': layerZIndex.value,
    }
  }

  return {
    width: props.width,
    'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 1rem)',
    top: layerTop.value,
    left: 0,
    'z-index': layerZIndex.value,
  }
})
</script>

<style scoped>
.p-sheet-panel {
  transition: left 200ms ease;
}

.p-sheet-panel.is-partial-pending {
  visibility: hidden;
}

.p-sheet-panel.is-shifted {
  opacity: 1;
}

.p-sheet-panel.is-shifted .sheet-content {
  pointer-events: none;
}

.p-sheet-mobile-page {
  display: block;
  min-width: 0;
  padding: 1rem 0 2rem;
  background: #ffffff;
}

.p-sheet-mobile-page__header {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.p-sheet-mobile-page__header h1 {
  flex: 1;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 650;
}

.p-sheet-mobile-page__back {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-primary);
  font: inherit;
  cursor: pointer;
}

.p-sheet-mobile-page__content {
  min-width: 0;
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
  overscroll-behavior: contain;
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

.slide-right-enter-active {
  animation: p-sheet-right-enter 5200ms cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: transform;
}

.slide-left-enter-active {
  transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.slide-right-leave-active {
  transition: transform 3800ms cubic-bezier(0.4, 0, 1, 1);
  will-change: transform;
}

.slide-left-leave-active {
  transition: transform 260ms cubic-bezier(0.4, 0, 1, 1);
  will-change: transform;
}

@keyframes p-sheet-right-enter {
  0% {
    transform: translateX(100%);
  }

  72% {
    transform: translateX(-1.25rem);
  }

  100% {
    transform: translateX(0);
  }
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
  transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.slide-up-leave-active {
  transition: transform 260ms cubic-bezier(0.4, 0, 1, 1);
  will-change: transform;
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

  .slide-right-enter-active {
    animation: p-sheet-right-enter 5200ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .slide-right-leave-active {
    transition-duration: 3800ms;
  }

  .slide-left-enter-from,
  .slide-left-leave-to,
  .slide-up-enter-from,
  .slide-up-leave-to {
    transform: none;
  }
}
</style>
