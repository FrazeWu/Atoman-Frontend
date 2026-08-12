<template>
  <div class="p-content-progress">
    <!-- 加载中或出现错误/超时时的居中遮罩卡片 -->
    <div v-if="loading || isTimeout || error" class="p-content-progress__overlay">
      <!-- 背景骨架屏插槽 (如果有) -->
      <div v-if="loading && $slots.skeleton" class="p-content-progress__skeleton-wrapper">
        <slot name="skeleton" />
      </div>

      <!-- 居中卡片容器 -->
      <div class="p-content-progress__card">
        <!-- 正常加载与慢网状态 -->
        <template v-if="loading && !isTimeout && !error">
          <div class="p-content-progress__track" aria-label="正在加载">
            <div
              class="p-content-progress__bar"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
          <p class="p-content-progress__text">
            {{ isSlow ? '网络连接较慢，正在加载...' : '正在加载...' }}
          </p>
        </template>

        <!-- 超时或发生错误状态 -->
        <template v-else>
          <div class="p-content-progress__error-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="p-content-progress__error-text">
            {{ isTimeout ? '加载超时，请检查网络' : (error || '加载失败') }}
          </p>
          <button
            v-if="retry"
            type="button"
            class="p-content-progress__retry-btn"
            @click="handleRetry"
          >
            重新加载
          </button>
        </template>
      </div>
    </div>

    <!-- 正常内容 -->
    <div v-else class="p-content-progress__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    error?: string | boolean | null
    slowThresholdSeconds?: number
    timeoutSeconds?: number
    retry?: () => void | Promise<void>
  }>(),
  {
    loading: false,
    error: null,
    slowThresholdSeconds: 3,
    timeoutSeconds: 10
  }
)

const progress = ref(0)
const isSlow = ref(false)
const isTimeout = ref(false)

let progressTimer: ReturnType<typeof setInterval> | null = null
let slowTimer: ReturnType<typeof setTimeout> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

function clearAllTimers() {
  if (progressTimer) clearInterval(progressTimer)
  if (slowTimer) clearTimeout(slowTimer)
  if (timeoutTimer) clearTimeout(timeoutTimer)
  progressTimer = null
  slowTimer = null
  timeoutTimer = null
}

function startLoadingTimers() {
  clearAllTimers()
  progress.value = 0
  isSlow.value = false
  isTimeout.value = false

  // 1. 进度条缓动 (0% -> 90%)
  const startTime = Date.now()
  progressTimer = setInterval(() => {
    if (progress.value < 90) {
      const elapsed = (Date.now() - startTime) / 1000
      // 缓动曲线
      const nextProgress = Math.min(88, Math.floor(100 * (1 - Math.exp(-elapsed / 2.5))))
      progress.value = Math.max(progress.value, nextProgress)
    }
  }, 100)

  // 2. 慢网提示定时器
  slowTimer = setTimeout(() => {
    if (props.loading && !isTimeout.value) {
      isSlow.value = true
    }
  }, props.slowThresholdSeconds * 1000)

  // 3. 超时定时器
  timeoutTimer = setTimeout(() => {
    if (props.loading) {
      isTimeout.value = true
      if (progressTimer) clearInterval(progressTimer)
    }
  }, props.timeoutSeconds * 1000)
}

function finishLoading() {
  progress.value = 100
  setTimeout(() => {
    clearAllTimers()
    isSlow.value = false
    isTimeout.value = false
  }, 200)
}

function handleRetry() {
  isTimeout.value = false
  isSlow.value = false
  if (props.retry) {
    props.retry()
  }
}

watch(
  () => props.loading,
  (newVal) => {
    if (newVal) {
      startLoadingTimers()
    } else {
      finishLoading()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  clearAllTimers()
})
</script>

<style scoped>
.p-content-progress {
  position: relative;
  width: 100%;
  min-height: 240px;
}

.p-content-progress__overlay {
  position: relative;
  width: 100%;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.p-content-progress__skeleton-wrapper {
  position: absolute;
  inset: 0;
  opacity: 0.45;
  pointer-events: none;
  overflow: hidden;
}

.p-content-progress__card {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 320px;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-color-scheme: dark) {
  .p-content-progress__card {
    background: rgba(24, 24, 27, 0.85);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
}

.p-content-progress__track {
  width: 100%;
  height: 4px;
  background: var(--a-color-surface-muted, rgba(0, 0, 0, 0.06));
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 0.875rem;
}

.p-content-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, var(--a-color-primary, #3b82f6), #60a5fa);
  border-radius: 999px;
  transition: width 0.15s ease-out;
}

.p-content-progress__text {
  font-size: 0.875rem;
  color: var(--a-color-text-muted, #64748b);
  margin: 0;
  font-weight: 500;
  animation: fadeIn 0.3s ease;
}

.p-content-progress__error-icon {
  color: var(--a-color-danger, #ef4444);
  margin-bottom: 0.5rem;
}

.p-content-progress__error-text {
  font-size: 0.875rem;
  color: var(--a-color-text, #1e293b);
  margin: 0 0 1rem 0;
  font-weight: 500;
}

.p-content-progress__retry-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-primary, #3b82f6);
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.p-content-progress__retry-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  transform: translateY(-1px);
}

.p-content-progress__retry-btn:active {
  transform: translateY(0);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
