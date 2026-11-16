<template>
  <aside class="blog-home__rail" aria-label="侧边推荐">
    <section v-if="channels.length" class="blog-home__rail-section">
      <div class="blog-home__rail-header">
        <Flame :size="16" class="blog-home__rail-icon is-hot" />
        <h2>热门频道</h2>
      </div>
      <div class="blog-home__rail-list">
        <BlogEntityCard
          v-for="ch in channels.slice(0, 5)"
          :key="ch.id"
          kind="channel"
          :title="ch.name"
          :cover-url="ch.cover_url"
          :owner-name="ch.user?.display_name || ch.user?.username"
          :owner-avatar="ch.user?.avatar_url"
          :description="ch.description"
          :updated-at="ch.updated_at"
          :show-subscribe="false"
          @select="emit('open-channel', ch)"
        />
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { Flame } from 'lucide-vue-next'
import BlogEntityCard from '@/components/blog/BlogEntityCard.vue'
import type { BlogChannel } from './blogHomeTypes'

defineProps<{
  channels: BlogChannel[]
}>()

const emit = defineEmits<{
  (e: 'open-channel', channel: BlogChannel): void
}>()
</script>

<style scoped>
.blog-home__rail {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.blog-home__rail-section {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
}

.blog-home__rail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem 0.5rem;
  background: var(--a-color-bg);
}

.blog-home__rail-header h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.blog-home__rail-icon.is-hot {
  color: var(--a-color-warning);
}

.blog-home__rail-list {
  display: flex;
  flex-direction: column;
}

@media (max-width: 1199px) {
  .blog-home__rail {
    display: none;
  }
}
</style>
