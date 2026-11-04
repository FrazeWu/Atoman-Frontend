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
