<template>
  <div
    ref="rootRef"
    class="p-help-tooltip"
    :class="[
      `p-help-tooltip--${size}`,
      `p-help-tooltip--${placement}`,
      { 'is-open': isOpen }
    ]"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @keydown.esc="close"
  >
    <!-- 默认问号按钮或自定义触发元素 -->
    <slot name="trigger" :is-open="isOpen" :toggle="toggle">
      <button
        type="button"
        class="p-help-tooltip__trigger"
        :aria-label="ariaLabel"
        :aria-describedby="isOpen ? tooltipId : undefined"
        :aria-expanded="isOpen"
        :data-testid="triggerTestId"
        @click="onClick"
      >
        <HelpCircle :size="iconSize" aria-hidden="true" />
      </button>
    </slot>

    <!-- 浮层内容 -->
    <div
      v-if="isOpen"
      :id="tooltipId"
      class="p-help-tooltip__popover"
      role="tooltip"
      @click.stop
    >
      <!-- 可选头部 -->
      <header v-if="title || kicker" class="p-help-tooltip__head">
        <strong v-if="title" class="p-help-tooltip__title">{{ title }}</strong>
        <span v-if="kicker" class="p-help-tooltip__kicker">{{ kicker }}</span>
      </header>

      <!-- 纯文本或插槽富内容 -->
      <div class="p-help-tooltip__body">
        <p v-if="text" class="p-help-tooltip__text">{{ text }}</p>
        <slot :close="close" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'
import { HelpCircle } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  text?: string
  title?: string
  kicker?: string
  placement?: 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
  trigger?: 'hover' | 'click' | 'both'
  size?: 'sm' | 'md'
  ariaLabel?: string
  triggerTestId?: string
}>(), {
  text: '',
  title: '',
  kicker: '',
  placement: 'top-end',
  trigger: 'both',
  size: 'md',
  ariaLabel: '查看说明',
  triggerTestId: undefined,
})

const emit = defineEmits<{
  open: []
  close: []
}>()

const isOpen = ref(false)
const isPinned = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const tooltipId = `p-help-tooltip-${getCurrentInstance()?.uid ?? 'unknown'}`

const iconSize = computed(() => (props.size === 'sm' ? 14 : 16))

let hoverTimeout: ReturnType<typeof setTimeout> | null = null

function clearHoverTimeout() {
  if (!hoverTimeout) return
  clearTimeout(hoverTimeout)
  hoverTimeout = null
}

function open() {
  clearHoverTimeout()
  if (isOpen.value) return
  isOpen.value = true
  emit('open')
}

function close() {
  clearHoverTimeout()
  isPinned.value = false
  if (!isOpen.value) return
  isOpen.value = false
  emit('close')
}

function toggle() {
  if (isOpen.value && isPinned.value) {
    close()
    return
  }
  isPinned.value = true
  open()
}

function onMouseEnter() {
  if (props.trigger === 'hover' || props.trigger === 'both') open()
}

function onMouseLeave() {
  if (props.trigger !== 'hover' && props.trigger !== 'both') return
  if (isPinned.value) return
  clearHoverTimeout()
  hoverTimeout = setTimeout(close, 120)
}

function onFocusIn() {
  open()
}

function onFocusOut(event: FocusEvent) {
  if (!rootRef.value?.contains(event.relatedTarget as Node | null)) close()
}

function onClick(event: MouseEvent) {
  event.stopPropagation()
  if (props.trigger === 'click' || props.trigger === 'both') toggle()
}

function handleDocumentClick(event: MouseEvent) {
  if (!rootRef.value?.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('click', handleDocumentClick))

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  clearHoverTimeout()
})

defineExpose({
  open,
  close,
  toggle,
  isOpen,
})
</script>

<style scoped>
.p-help-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.p-help-tooltip__trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.p-help-tooltip__trigger::before {
  position: absolute;
  inset: -10px;
  content: '';
}

.p-help-tooltip--sm .p-help-tooltip__trigger {
  width: 20px;
  height: 20px;
}

.p-help-tooltip--sm .p-help-tooltip__trigger::before {
  inset: -12px;
}

.p-help-tooltip__trigger:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.p-help-tooltip__trigger:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

.p-help-tooltip__popover {
  position: absolute;
  z-index: var(--a-z-popover);
  width: max-content;
  min-width: 180px;
  max-width: min(280px, calc(100vw - 2rem));
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-md);
  color: var(--a-color-fg);
  animation: p-tooltip-fade 0.18s ease-out;
}

@keyframes p-tooltip-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Placements */
.p-help-tooltip--top-end .p-help-tooltip__popover {
  right: 0;
  bottom: calc(100% + 8px);
}

.p-help-tooltip--top-start .p-help-tooltip__popover {
  left: 0;
  bottom: calc(100% + 8px);
}

.p-help-tooltip--top .p-help-tooltip__popover {
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(100% + 8px);
}

.p-help-tooltip--bottom-end .p-help-tooltip__popover {
  right: 0;
  top: calc(100% + 8px);
}

.p-help-tooltip--bottom-start .p-help-tooltip__popover {
  left: 0;
  top: calc(100% + 8px);
}

.p-help-tooltip--bottom .p-help-tooltip__popover {
  left: 50%;
  transform: translateX(-50%);
  top: calc(100% + 8px);
}

.p-help-tooltip__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.45rem;
  margin-bottom: 0.45rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.p-help-tooltip__title {
  font-size: 0.78rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.p-help-tooltip__kicker {
  font-size: 0.68rem;
  font-weight: 600;
  color: #d97706;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  padding: 0.1em 0.45em;
  border-radius: var(--a-radius-pill, 999px);
  white-space: nowrap;
}

.p-help-tooltip__body {
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--a-color-text-secondary);
}

.p-help-tooltip__text {
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .p-help-tooltip__popover {
    animation: none;
  }
}
</style>
