<template>
  <div class="notfound-page">
    <div class="notfound-card">
      <p class="notfound-code">404</p>
      <h1 class="notfound-title">页面不存在</h1>
      <p class="notfound-desc">
        你访问的路径可能已迁移、删除，或输入有误。
      </p>
      <div class="notfound-actions">
        <RouterLink to="/" class="btn-main">回到首页</RouterLink>
        <a :href="moduleUrl('music')" class="btn-sub">到专辑收藏</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { moduleUrl } from '@/router/siteUrls'
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
  border: 1px solid var(--a-color-line-soft);
  padding: 2rem;
  background: #fff;
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
  color: #4b5563;
  font-size: 0.95rem;
}

.notfound-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-main,
.btn-sub {
  text-decoration: none;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.6rem 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  transition: all 0.2s;
}

.btn-main {
  background: #000;
  color: #fff;
}

.btn-main:hover {
  background: #fff;
  color: #000;
}

.btn-sub {
  background: #fff;
  color: #000;
}

.btn-sub:hover {
  background: #000;
  color: #fff;
}
</style>
