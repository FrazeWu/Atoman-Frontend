<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePostQuery } from '@/entities/post'
import BlogPostReader from '@/components/blog/BlogPostReader.vue'
import { PSkeleton, PEmpty } from '@/shared/ui'

const route = useRoute()
const postSlugOrId = computed(() => (route.params.slugOrId as string) || (route.params.id as string) || '')

const { data: post, isLoading, error, refetch } = usePostQuery(postSlugOrId)
</script>

<template>
  <div class="post-detail-page">
    <div v-if="isLoading" class="post-detail-page__loading" style="padding: 2rem;">
      <PSkeleton style="height: 2.5rem; width: 60%; margin-bottom: 1.5rem;" />
      <PSkeleton style="height: 1.25rem; width: 40%; margin-bottom: 2rem;" />
      <PSkeleton style="height: 12rem; width: 100%;" />
    </div>
    <div v-else-if="error" class="post-detail-page__error" style="padding: 3rem 1rem;">
      <PEmpty title="文章加载失败" :description="error.message">
        <template #action>
          <button class="a-button" @click="() => refetch()">重新加载</button>
        </template>
      </PEmpty>
    </div>
    <BlogPostReader v-else-if="post" :post="post" :post-id="String(post.id || postSlugOrId)" />
  </div>
</template>

<style scoped>
.post-detail-page {
  width: 100%;
  min-width: 0;
}
</style>
