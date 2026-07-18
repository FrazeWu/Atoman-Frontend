<template>
  <div class="route-content-loading" role="status" aria-live="polite">
    正在加载...
  </div>
</template>

<style scoped>
.route-content-loading {
  display: grid;
  min-height: min(40vh, 20rem);
  place-items: center;
  color: var(--a-color-muted);
  font-size: var(--a-text-sm);
  font-weight: 500;
}
</style>
