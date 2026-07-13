<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next'

withDefaults(defineProps<{
  headingLevel?: 'h1' | 'h2'
}>(), {
  headingLevel: 'h2',
})
</script>

<template>
  <article class="site-info-content">
    <component :is="headingLevel" class="site-info-title">关于凹凸庵</component>
    <p class="site-info-lead">
      凹凸庵是一个开源、可自托管的内容社区，提供写作、订阅、音乐与影像归档、播客、论坛、辩论和时间线等内容空间。
    </p>

    <section class="site-info-section">
      <h3>我们的理念</h3>
      <p>我们希望打造一个纯粹、求真的网络空间。</p>
      <p>尊重事实与完整语境，鼓励真诚表达和开放讨论。</p>
    </section>

    <section class="site-info-section">
      <h3>开放源代码</h3>
      <p>项目遵循 GPL v3 协议，源代码公开在 GitHub。</p>
      <a
        class="site-info-action"
        data-footer-action="source"
        href="https://github.com/FrazeWu/Atoman"
        target="_blank"
        rel="noopener noreferrer"
      >
        查看源代码
        <ExternalLink :size="16" aria-hidden="true" />
      </a>
    </section>
  </article>
</template>

<style scoped>
.site-info-content {
  color: var(--a-color-fg);
}

.site-info-title {
  margin: 0;
  font-size: 2rem;
  font-weight: var(--a-font-weight-black);
  line-height: 1.2;
  letter-spacing: 0;
}

.site-info-lead,
.site-info-section p {
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-md);
  line-height: 1.75;
}

.site-info-lead {
  margin: var(--a-space-5) 0 0;
}

.site-info-section {
  margin-top: 2.5rem;
  padding-top: var(--a-space-6);
  border-top: var(--a-border);
}

.site-info-section h3 {
  margin: 0 0 var(--a-space-4);
  font-size: var(--a-text-md);
  font-weight: var(--a-font-weight-black);
}

.site-info-section p {
  margin: 0;
}

.site-info-section p + p {
  margin-top: var(--a-space-2);
}

.site-info-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--a-space-2);
  min-height: 44px;
  margin-top: var(--a-space-5);
  padding: 0 var(--a-space-4);
  border: var(--a-border);
  color: var(--a-color-fg);
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
  text-decoration: none;
}

.site-info-action:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.site-info-action:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .site-info-title {
    font-size: 1.625rem;
  }

  .site-info-section {
    margin-top: var(--a-space-6);
    padding-top: var(--a-space-5);
  }
}
</style>
