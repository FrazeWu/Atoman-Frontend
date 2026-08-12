<template>
  <div class="p-content-progress">
    <!-- 加载中遮罩卡片/居中区 -->
    <div v-if="loading || error" class="p-content-progress__overlay">
      <!-- 背景骨架屏插槽 (如果有) -->
      <div v-if="loading && $slots.skeleton" class="p-content-progress__skeleton-wrapper">
        <slot name="skeleton" />
      </div>

      <!-- 居中加载区 -->
      <div class="p-content-progress__loader" role="status" aria-label="正在加载">
        <template v-if="loading && !error">
          <div class="p-content-progress__track">
            <div class="p-content-progress__bar" />
          </div>
          <div class="p-content-progress__stage-wrap">
            <Transition name="stage-slide" mode="out-in">
              <span :key="stageIndex" class="p-content-progress__text">
                <template v-if="stageIndex === 3">
                  加载时间较长，<button type="button" class="p-content-progress__retry-link" @click="handleRetry">重新加载</button>
                </template>
                <template v-else>
                  {{ currentText }}
                </template>
              </span>
            </Transition>
          </div>
        </template>

        <!-- 显式错误状态 -->
        <template v-else-if="error">
          <div class="p-content-progress__stage-wrap">
            <span class="p-content-progress__text p-content-progress__text--error">
              {{ typeof error === 'string' ? error : '加载失败' }}，
              <button type="button" class="p-content-progress__retry-link" @click="handleRetry">重新加载</button>
            </span>
          </div>
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
import { ref, computed, watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    error?: string | boolean | null
    retry?: () => any
  }>(),
  {
    loading: false,
    error: null,
  }
)

const stageTexts = [
  '正在加载',
  '网络较慢，请稍候',
  '仍在加载中…',
  '加载时间较长'
]

const stageIndex = ref(0)
const currentText = computed(() => stageTexts[stageIndex.value] || stageTexts[0])

let timers: ReturnType<typeof setTimeout>[] = []

function clearTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers = []
}

function startStageTimers() {
  clearTimers()
  stageIndex.value = 0

  // 3s -> 阶段 1
  timers.push(
    setTimeout(() => {
      if (props.loading) stageIndex.value = 1
    }, 3000)
  )

  // 8s -> 阶段 2
  timers.push(
    setTimeout(() => {
      if (props.loading) stageIndex.value = 2
    }, 8000)
  )

  // 15s -> 阶段 3（提示重新加载）
  timers.push(
    setTimeout(() => {
      if (props.loading) stageIndex.value = 3
    }, 15000)
  )
}

function handleRetry() {
  if (props.retry) {
    props.retry()
  } else {
    window.location.reload()
  }
}

watch(
  () => props.loading,
  (newVal) => {
    if (newVal) {
      startStageTimers()
    } else {
      clearTimers()
      stageIndex.value = 0
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  clearTimers()
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

/* 居中加载区 */
.p-content-progress__loader {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

/* 轨道 */
.p-content-progress__track {
  width: 200px;
  height: 3px;
  background: var(--a-color-surface-muted, rgba(0, 0, 0, 0.07));
  border-radius: 999px;
  overflow: hidden;
}

/* 滑动长条 */
.p-content-progress__bar {
  height: 100%;
  width: 45%;
  background: var(--a-color-primary, #3b82f6);
  border-radius: 999px;
  animation: p-bar-slide 1.6s linear infinite;
}

@keyframes p-bar-slide {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(240%); }
}

/* 阶段文字垂直滑动容器 */
.p-content-progress__stage-wrap {
  width: 260px;
  height: 1.4rem;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.p-content-progress__text {
  font-size: 0.8125rem;
  color: var(--a-color-muted, #94a3b8);
  font-weight: 500;
  line-height: 1.4rem;
  white-space: nowrap;
  text-align: center;
  display: block;
}

.p-content-progress__text--error {
  color: var(--a-color-text, #1e293b);
}

.p-content-progress__retry-link {
  border: 0;
  background: none;
  color: var(--a-color-primary, #3b82f6);
  font-size: inherit;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  display: inline;
}

.p-content-progress__retry-link:hover {
  opacity: 0.75;
}

.p-content-progress__content {
  width: 100%;
}

/* 向上滑出 / 向下滑入 Transition */
.stage-slide-enter-active,
.stage-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
}

.stage-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.stage-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
