<template>
  <div class="route-content-loading" role="status" aria-live="polite" aria-label="正在加载内容">
    <div class="loading-container">
      <div class="spinner-ring"></div>
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
  min-height: min(50vh, 24rem);
  place-items: center;
  background: transparent;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

/* 高级流光 Spinner */
.spinner-ring {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 30%, var(--a-color-muted, #64748b) 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
  animation: spin 0.8s linear infinite;
}

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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}
</style>
