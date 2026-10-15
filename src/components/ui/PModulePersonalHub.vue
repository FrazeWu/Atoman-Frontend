<template>
  <div class="a-page-md p-module-personal-hub">
    <PPageHeader :title="title" :sub="subtitle" mb="1.25rem">
      <template #action>
        <slot name="action" />
      </template>
    </PPageHeader>

    <PEmpty
      v-if="!authenticated"
      :title="unauthTitle"
      :description="unauthDescription"
    >
      <template #action>
        <PButton to="/login" variant="primary">登录</PButton>
      </template>
    </PEmpty>

    <template v-else>
      <p v-if="error" class="p-hub__error" role="alert">{{ error }}</p>
      <div v-if="loading" class="p-hub__loading">加载中...</div>

      <div v-else-if="stats && stats.length" class="p-hub__stats" aria-label="数据统计">
        <article v-for="stat in stats" :key="stat.label" class="p-hub__stat">
          <component :is="stat.icon" v-if="stat.icon" :size="18" aria-hidden="true" class="p-hub__stat-icon" />
          <strong class="p-hub__stat-val">{{ stat.value }}</strong>
          <span class="p-hub__stat-lbl">{{ stat.label }}</span>
        </article>
      </div>

      <nav v-if="links && links.length" class="p-hub__links" :class="[columns === 2 ? 'is-2-cols' : '']" aria-label="快捷入口">
        <RouterLink
          v-for="link in links"
          :key="link.label"
          :to="link.to"
          class="p-hub__link"
        >
          <component :is="link.icon" v-if="link.icon" :size="18" aria-hidden="true" class="p-hub__link-icon" />
          <span class="p-hub__link-label">{{ link.label }}</span>
        </RouterLink>
      </nav>

      <section v-if="$slots.default" class="p-hub__content">
        <slot />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'

export interface HubStat {
  label: string
  value: number | string
  icon?: Component
}

export interface HubLink {
  label: string
  to: string
  icon?: Component
}

withDefaults(defineProps<{
  title?: string
  subtitle?: string
  authenticated?: boolean
  loading?: boolean
  error?: string
  unauthTitle?: string
  unauthDescription?: string
  stats?: HubStat[]
  links?: HubLink[]
  columns?: 1 | 2
}>(), {
  title: '我的',
  subtitle: '',
  authenticated: true,
  loading: false,
  error: '',
  unauthTitle: '请先登录',
  unauthDescription: '登录账号以查看你的个人内容。',
  stats: () => [],
  links: () => [],
  columns: 1,
})
</script>

<style scoped>
.p-module-personal-hub { min-height: 100%; padding-bottom: 3rem; }
.p-hub__error { color: var(--a-color-danger); font-size: 0.8rem; margin-bottom: 1rem; }
.p-hub__loading { color: var(--a-color-muted); font-size: 0.8rem; margin-bottom: 1.5rem; }

.p-hub__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.p-hub__stat {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}
.p-hub__stat-icon { color: var(--a-color-muted); }
.p-hub__stat-val { font-size: 1.35rem; font-weight: 500; }
.p-hub__stat-lbl { color: var(--a-color-muted); font-size: 0.8rem; }

.p-hub__links {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 2rem;
}
.p-hub__links.is-2-cols {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.p-hub__link {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: border-color 0.15s ease;
}
.p-hub__link:hover, .p-hub__link:focus-visible {
  border-color: var(--a-color-fg);
}
.p-hub__link-icon {
  color: var(--a-color-muted);
  flex-shrink: 0;
}
.p-hub__content {
  display: grid;
  gap: 1rem;
}

@media (max-width: 520px) {
  .p-hub__stats { grid-template-columns: 1fr; }
  .p-hub__links.is-2-cols { grid-template-columns: 1fr; }
}
</style>
