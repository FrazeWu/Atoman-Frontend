<template>
  <div class="route-content-loading" role="status" aria-live="polite" aria-label="正在加载内容">
    <div class="loading-container">
      <div class="progress-line-track">
        <div class="progress-line-bar"></div>
      </div>
      <div class="loading-text">
        <span>正在加载</span>
        <span class="dot-flow"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.route-content-loading {
  display: grid;
  min-height: min(60vh, 32rem);
  place-items: center;
  background: transparent;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 180px;
}

/* 进度条背景轨道 */
.progress-line-track {
  width: 100%;
  height: 3px;
  background: var(--a-color-border-soft, #e2e8f0);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

/* 进度条流动条 */
.progress-line-bar {
  height: 100%;
  width: 35%;
  background: var(--a-color-primary, #2563eb);
  position: absolute;
  left: -35%;
  border-radius: 2px;
  animation: indeterminate-center-bar 1.5s infinite ease-in-out;
}

/* 文字标签 */
.loading-text {
  font-size: var(--a-text-sm, 0.875rem);
  font-weight: 500;
  color: var(--a-color-muted, #64748b);
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
}

.dot-flow::after {
  content: '';
  display: inline-block;
  width: 12px;
  text-align: left;
  animation: dots 1.6s steps(4, end) infinite;
}

/* 流动动画 */
@keyframes indeterminate-center-bar {
  0% {
    left: -35%;
    width: 35%;
  }
  50% {
    left: 30%;
    width: 50%;
  }
  100% {
    left: 100%;
    width: 35%;
  }
}

@keyframes dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}
</style>

