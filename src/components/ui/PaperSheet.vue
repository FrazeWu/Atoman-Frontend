<template>
  <div class="paper-sheet-root">
    <!-- Backdrop to catch clicks outside the sheet -->
    <Transition name="fade">
      <div v-if="show" class="paper-sheet-backdrop" :style="{ top: top }" @click="$emit('close')" />
    </Transition>

    <Transition :name="side === 'left' ? 'slide-left' : 'slide-right'">
      <div v-if="show" class="paper-sheet-layer paper-sheet-panel" :class="[`is-${side}`, { 'is-shifted': isShifted }]" :style="sheetStyle">
        <!-- Left/Right Edge Close Tab (Taped Component Style) -->
        <PaperSheetTab 
          v-if="closeType === 'bookmark' || closeType === 'both'"
          class="sheet-tab-position"
          :title="title" 
          @click="$emit('close')" 
        />

        <div class="sheet-header">
          <slot name="header">
            <span class="a-font-meta sheet-header-label">{{ title.toUpperCase() }}</span>
          </slot>
          <button v-if="closeType === 'header' || closeType === 'both'" class="header-close-btn a-font-meta" @click="$emit('close')">CLOSE</button>
        </div>
        
        <div class="sheet-content hide-scrollbar">
          <div :class="{ 'sheet-content-inner': readingMode }">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PaperSheetTab from './PaperSheetTab.vue'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  width?: string
  maxWidth?: string
  top?: string
  side?: 'left' | 'right'
  closeType?: 'bookmark' | 'header' | 'both'
  readingMode?: boolean // If true, adds 720px max-width to content
  isShifted?: boolean
}>(), {
  title: 'VIEW',
  width: 'min(100%, 480px)',
  top: '56px',
  side: 'right',
  closeType: 'bookmark',
  readingMode: false,
  isShifted: false
})

defineEmits(['close'])

const sheetStyle = computed(() => ({
  width: props.width,
  'max-width': props.maxWidth || 'calc(100vw - var(--a-sidebar-width) - 16px)',
  top: props.top,
  [props.side === 'left' ? 'left' : 'right']: 0
}))
</script>

<style scoped>
.paper-sheet-panel {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.paper-sheet-panel.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.6;
  pointer-events: none;
}

.paper-sheet-layer {
  position: fixed;
  bottom: 0;
  background: white;
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.paper-sheet-layer.is-right {
  right: 0;
  border-left: 1px solid var(--a-color-line-soft);
  box-shadow: none;
}

.paper-sheet-layer.is-left {
  left: 0;
  border-right: 1px solid var(--a-color-line-soft);
  box-shadow: none;
}

.paper-sheet-backdrop {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.02); /* Extremely subtle tint */
  z-index: 999;
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
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--a-color-muted);
}

.header-close-btn {
  background: none;
  border: none;
  color: black;
  font-size: 0.75rem;
  font-weight: 900;
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
</style>
