<template>
  <section
    v-if="loading || digest || error"
    class="blog-home__digest"
    :aria-labelledby="digest ? 'blog-digest-title' : undefined"
    :aria-label="error ? '订阅摘要' : undefined"
  >
    <div v-if="loading" class="a-skeleton blog-home__digest-skeleton" aria-hidden="true" />
    <template v-else-if="digest">
      <div class="blog-home__digest-summary">
        <p class="blog-home__digest-eyebrow">订阅{{ digest.period === 'day' ? '日报' : '周报' }}</p>
        <h2 id="blog-digest-title">过去{{ digest.period === 'day' ? '24 小时' : '7 天' }}有 {{ digest.total }} 篇新文章</h2>
      </div>
      <div class="blog-home__digest-items">
        <button
          v-for="item in digest.items"
          :key="item.id"
          type="button"
          class="blog-home__digest-item"
          @click="emit('open-item', item)"
        >
          <span class="blog-home__digest-item-title">{{ item.title }}</span>
          <small class="blog-home__digest-item-channel">{{ item.channel?.name || '订阅频道' }}</small>
        </button>
      </div>
    </template>
    <p v-else class="blog-home__digest-error" role="status">
      订阅摘要加载失败
      <PButton size="sm" variant="ghost" label="重试" @click="emit('retry')" />
    </p>
  </section>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import type { BlogDigestPayload } from './blogHomeTypes'

defineProps<{
  digest: BlogDigestPayload | null
  loading: boolean
  error: boolean
}>()

const emit = defineEmits<{
  (e: 'open-item', item: BlogDigestPayload['items'][number]): void
  (e: 'retry'): void
}>()
</script>

<style scoped>
.blog-home__digest {
  display: grid;
  grid-template-columns: minmax(13rem, 0.75fr) minmax(0, 1.25fr);
  gap: 1.25rem 2rem;
  align-items: center;
  margin: 1.25rem 0 1.75rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface-subtle, var(--a-color-bg));
}

.blog-home__digest-summary {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.blog-home__digest-eyebrow {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.blog-home__digest h2 {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 1.05rem;
  font-weight: 500;
  line-height: 1.4;
}

.blog-home__digest-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.blog-home__digest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.blog-home__digest-item:hover,
.blog-home__digest-item:focus-visible {
  border-color: var(--a-color-border-hover, var(--a-color-fg));
  background-color: var(--a-color-surface-muted);
  color: var(--a-color-primary);
  outline: none;
}

.blog-home__digest-item:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.blog-home__digest-item-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.blog-home__digest-item-channel {
  flex-shrink: 0;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.blog-home__digest-skeleton {
  grid-column: 1 / -1;
  height: 4.5rem;
  border-radius: var(--a-radius-card);
}

.blog-home__digest-error {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .blog-home__digest {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 1rem;
  }
}
</style>
