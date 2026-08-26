<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'

export interface BlogRelatedPost {
  id: string
  title: string
  summary?: string
  image_url?: string
  target_path: string
  score_label?: string
}

defineProps<{
  items: BlogRelatedPost[]
}>()

const emit = defineEmits<{
  select: [item: BlogRelatedPost]
}>()
</script>

<template>
  <section v-if="items.length" class="blog-related" aria-label="继续阅读">
    <div class="blog-related__header">
      <h2>继续阅读</h2>
    </div>
    <div class="blog-related__list">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="blog-related__item"
        @click="emit('select', item)"
      >
        <div class="blog-related__cover">
          <img v-if="item.image_url" :src="item.image_url" :alt="item.title" loading="lazy" />
          <BookOpen v-else :size="20" aria-hidden="true" />
        </div>
        <div class="blog-related__body">
          <span v-if="item.score_label" class="blog-related__reason">{{ item.score_label }}</span>
          <h3>{{ item.title }}</h3>
          <p v-if="item.summary">{{ item.summary }}</p>
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.blog-related {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.blog-related__header {
  margin-bottom: 1rem;
}

.blog-related__header h2 {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 1.1rem;
  font-weight: 600;
}

.blog-related__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.blog-related__item {
  display: flex;
  min-width: 0;
  gap: 0.85rem;
  padding: 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.blog-related__item:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.blog-related__item:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 3px;
}

.blog-related__cover {
  display: grid;
  flex: 0 0 3.5rem;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  overflow: hidden;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
}

.blog-related__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.blog-related__body {
  min-width: 0;
}

.blog-related__reason {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--a-color-muted);
  font-size: 0.72rem;
}

.blog-related__body h3 {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.blog-related__body p {
  display: -webkit-box;
  margin: 0.35rem 0 0;
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.78rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 640px) {
  .blog-related__list {
    grid-template-columns: 1fr;
  }
}
</style>
