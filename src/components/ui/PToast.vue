<template>
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="visible"
        class="p-toast"
        :class="type ? `p-toast--${type}` : 'p-toast--info'"
        :style="{ top: `${resolvedTop}px` }"
        role="status"
        @mouseenter="clearTimer"
        @mouseleave="startTimer"
      >
        <span class="p-toast-dot" aria-hidden="true" />
        <div class="p-toast-content">
          <strong v-if="title" class="p-toast-title">{{ title }}</strong>
          <span class="p-toast-message">{{ message }}</span>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  show?: boolean
  title?: string
  message: string
  duration?: number
  top?: number
  type?: 'success' | 'warning' | 'danger' | 'error' | 'info'
}>(), {
  modelValue: undefined,
  show: undefined,
  title: '',
  duration: 1800,
  top: 32,
  type: 'info',
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'update:show': [boolean]
}>()

const visible = ref(false)
const timer = ref<number | null>(null)
const controlledValue = computed(() => props.modelValue ?? props.show ?? true)
const resolvedTop = computed(() => props.top)

watch(controlledValue, (value) => {
  visible.value = value
  if (value) startTimer()
  else clearTimer()
}, { immediate: true })

function startTimer() {
  clearTimer()
  if (props.duration !== 0) {
    timer.value = window.setTimeout(() => {
      emit('update:modelValue', false)
      emit('update:show', false)
    }, props.duration)
  }
}

function clearTimer() {
  if (timer.value !== null) {
    clearTimeout(timer.value)
    timer.value = null
  }
}

onUnmounted(clearTimer)
</script>

<style scoped>
.p-toast {
  position: fixed;
  left: 50%;
  z-index: var(--a-z-toast);
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px;
  max-width: 80vw;
  transform: translateX(-50%);
  border-radius: var(--a-radius-none, 4px);
  padding: 8px 14px;
  background: #ffffff;
  color: var(--a-color-ink);
  border: 1px solid var(--a-color-line);
  box-shadow: none;
  transition: top 0.3s ease;
}

.p-toast-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.p-toast--info .p-toast-dot {
  background-color: var(--a-color-ink-soft);
}

.p-toast--success .p-toast-dot {
  background-color: var(--a-color-success);
}

.p-toast--warning .p-toast-dot {
  background-color: var(--a-color-warning);
}

.p-toast--danger .p-toast-dot,
.p-toast--error .p-toast-dot {
  background-color: var(--a-color-danger);
}

.p-toast-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.2;
}

.p-toast-title {
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
