<template>
  <div class="p-content-progress">
    <div v-if="loading" class="p-content-progress__overlay">
      <!-- 背景骨架屏插槽 -->
      <div v-if="$slots.skeleton" class="p-content-progress__skeleton-wrapper">
        <slot name="skeleton" />
      </div>

      <!-- 居中加载条 -->
      <div class="p-content-progress__loader" role="status" aria-label="正在加载">
        <div class="p-content-progress__track">
          <div class="p-content-progress__bar" />
        </div>
        <p class="p-content-progress__text">正在加载</p>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="p-content-progress__overlay">
      <div class="p-content-progress__loader">
        <div class="p-content-progress__error-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="p-content-progress__text">{{ typeof error === 'string' ? error : '加载失败' }}</p>
        <button v-if="retry" type="button" class="p-content-progress__retry-btn" @click="retry?.()">
          重新加载
        </button>
      </div>
    </div>

    <!-- 正常内容 -->
    <div v-else class="p-content-progress__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading?: boolean
  error?: string | boolean | null
  retry?: () => any
}>()
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
  animation: p-bar-slide 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes p-bar-slide {
  0%   { transform: translateX(-120%); }
  60%  { transform: translateX(240%); }
  100% { transform: translateX(240%); }
}

/* 文字 */
.p-content-progress__text {
  font-size: 0.8125rem;
  color: var(--a-color-muted, #94a3b8);
  font-weight: 500;
  margin: 0;
}

/* 错误图标 */
.p-content-progress__error-icon {
  color: var(--a-color-danger, #ef4444);
}

/* 重试按钮 */
.p-content-progress__retry-btn {
  border: 0;
  background: none;
  color: var(--a-color-primary, #3b82f6);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  margin-top: 0.25rem;
}

.p-content-progress__retry-btn:hover {
  opacity: 0.7;
}

.p-content-progress__content {
  width: 100%;
}
</style>
