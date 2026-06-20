<template>
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
      <strong v-if="title">{{ title }}</strong>
      <span>{{ message }}</span>
    </div>
  </transition>
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
  type?: 'success' | 'danger' | 'error' | 'info'
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
  display: grid;
  gap: 4px;
  min-width: 120px;
  max-width: 80vw;
  transform: translateX(-50%);
  border-radius: 0px; /* Straight corner */
  padding: 10px 18px;
  text-align: center;
  box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.12); /* Hard shadow */
}

.p-toast--info {
  background: #ffffff;
  color: var(--a-color-ink);
  border: 1px solid var(--a-color-line);
}

.p-toast--success {
  background: #f0fdf4; /* Morandi pale green */
  color: #166534; /* Dark green */
  border: 1px solid #166534;
}

.p-toast--danger,
.p-toast--error {
  background: #fef2f2; /* Morandi pale red */
  color: #991b1b; /* Dark red */
  border: 1px solid #991b1b;
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
