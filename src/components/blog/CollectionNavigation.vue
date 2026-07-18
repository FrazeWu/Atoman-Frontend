<template>
  <nav class="collection-navigation" aria-label="合集文章">
    <div class="collection-navigation__heading">
      <span class="a-label">合集</span>
      <strong>{{ post.collection?.name || '默认合集' }}</strong>
    </div>
    <RouterLink
      v-for="item in posts"
      :key="item.id"
      :to="`/posts/post/${item.id}`"
      class="collection-navigation__item"
      :class="{ active: item.id === post.id }"
    >
      {{ item.title }}
    </RouterLink>
    <div class="collection-navigation__steps">
      <RouterLink v-if="previousPost" :to="`/posts/post/${previousPost.id}`">← {{ previousPost.title }}</RouterLink>
      <RouterLink v-if="nextPost" :to="`/posts/post/${nextPost.id}`">{{ nextPost.title }} →</RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Post } from '@/types'

defineProps<{
  post: Post
  posts: Post[]
  previousPost: Post | null
  nextPost: Post | null
}>()
</script>

<style scoped>
.collection-navigation { display: grid; gap: 0.35rem; }
.collection-navigation__heading { display: grid; gap: 0.3rem; margin-bottom: 0.7rem; }
.collection-navigation__item { padding: 0.5rem 0; color: var(--a-color-muted); text-decoration: none; line-height: 1.35; }
.collection-navigation__item.active { color: var(--a-color-fg); font-weight: 800; }
.collection-navigation__steps { display: grid; gap: 0.65rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--a-color-border-soft); }
.collection-navigation__steps a { color: var(--a-color-muted); text-decoration: none; font-size: 0.8rem; }
</style>
