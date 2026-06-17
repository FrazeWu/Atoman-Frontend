<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import ABtn from '@/components/ui/ABtn.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperTab from '@/components/ui/PaperTab.vue'
import { useApi } from '@/composables/useApi'
import { modulePathUrl } from '@/router/siteUrls'
import type { Post } from '@/types'

const api = useApi()
const posts = ref<Post[]>([])
const loading = ref(false)

const loadArticles = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: '1', limit: '20' })
    const res = await fetch(`${api.blog.explore}?${params}`)
    if (!res.ok) return
    const data = await res.json()
    const rows = data.data || data || []
    posts.value = rows.map((item: any) => item.post || item).filter(Boolean)
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const goToPost = (id: string) => {
  const url = modulePathUrl('blog', `/post/${id}`)
  window.location.assign(url)
}

onMounted(loadArticles)
</script>

<template>
  <div class="a-page-xl kanbo-explore-page">
    <APageHeader title="文章" sub="探索本网站发布的全部文章。" accent>
      <template #action>
        <div class="kanbo-explore-actions">
          <PaperTab label="最新" active />
          <ABtn to="/create" outline size="sm">返回创作</ABtn>
        </div>
      </template>
    </APageHeader>
    <div v-if="loading" class="a-skeleton kanbo-list-skeleton" />
    <AEmpty v-else-if="posts.length === 0" text="暂无文章" />
    <div v-else class="kanbo-posts-list">
      <article 
        v-for="post in posts" 
        :key="post.id" 
        class="a-card-sm kanbo-list-item a-cursor-pointer"
        @click="goToPost(post.id)"
      >
        <div class="post-item-meta">
          <span class="post-item-author">{{ post.user?.display_name || post.user?.username || '作者' }}</span>
          <span class="post-item-sep">•</span>
          <span class="post-item-date">{{ formatDate(post.created_at) }}</span>
        </div>
        <strong class="post-item-title">{{ post.title }}</strong>
        <p class="a-muted post-item-summary">{{ post.summary }}</p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.kanbo-list-skeleton {
  height: 8rem;
}

.kanbo-posts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.kanbo-list-item {
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  border-radius: 4px;
}

.kanbo-list-item:hover {
  border-color: var(--a-color-fg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.post-item-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--a-letter-spacing-wide);
  margin-bottom: 0.35rem;
}

.post-item-author {
  color: var(--a-color-fg);
}

.post-item-title {
  display: block;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.3;
  margin-bottom: 0.4rem;
  color: var(--a-color-fg);
}

.post-item-summary {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.kanbo-explore-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
