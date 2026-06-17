<template>
  <transition name="fade">
    <div
      v-if="visible"
      class="p-toast"
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
}>(), {
  modelValue: undefined,
  show: undefined,
  title: '',
  duration: 1800,
  top: 32,
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
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
  box-shadow: var(--a-shadow-paper-sm);
  color: var(--a-color-ink);
  padding: 12px 14px;
  text-align: center;
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
