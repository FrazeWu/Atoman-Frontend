<template>
  <div class="notfound-page">
    <div class="notfound-card">
      <p class="notfound-code">404</p>
      <h1 class="notfound-title">页面不存在</h1>
      <p class="notfound-desc">
        你访问的路径可能已迁移、删除，或输入有误。
      </p>
      <div class="notfound-actions">
        <PButton to="/" variant="primary">回到首页</PButton>
        <PButton :href="moduleUrl('music')" variant="secondary">到专辑收藏</PButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { moduleUrl } from '@/router/siteUrls'
import PButton from '@/components/ui/PButton.vue'
</script>

<style scoped>
.notfound-page {
  min-height: calc(100vh - 10rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.notfound-card {
  width: min(40rem, 100%);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  padding: 2rem;
  background: var(--a-color-bg);
  box-shadow: none;
}

.notfound-code {
  margin: 0 0 0.5rem;
  font-size: 4rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1;
}

.notfound-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 500;
  letter-spacing: 0;
}

.notfound-desc {
  margin: 1rem 0 0;
  color: var(--a-color-text-secondary);
  font-size: 0.95rem;
}

.notfound-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
