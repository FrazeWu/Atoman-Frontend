<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTab from '@/components/ui/PTab.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PEntry from '@/components/ui/PEntry.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import { useApi } from '@/composables/useApi'
import { modulePathUrl } from '@/router/siteUrls'
import type { Post, TimelineItem } from '@/types'

const api = useApi()
const posts = ref<Post[]>([])
const loading = ref(false)
const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)

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

const postAuthorName = (post: Post) => post.user?.display_name || post.user?.username || ''

const openArticleSheet = (post: Post) => {
  selectedArticle.value = {
    type: 'post',
    post,
    published_at: post.created_at,
    is_read: false,
  }
  showArticleSheet.value = true
}

onMounted(loadArticles)
</script>

<template>
  <div class="a-page-xl media-explore-page">
    <FeedArticleSheet :show="showArticleSheet" :article="selectedArticle" @close="showArticleSheet = false" />

    <PPageHeader title="文章" accent>
      <template #action>
        <div class="media-explore-actions">
          <PTab label="最新" active />
          <PButton :to="modulePathUrl('media', '/create')" outline size="sm">返回创作</PButton>
        </div>
      </template>
    </PPageHeader>
    <div v-if="loading" class="a-skeleton media-list-skeleton" />
    <PEmpty v-else-if="posts.length === 0" text="暂无文章" />
    <div v-else class="media-article-list">
      <PEntry
        v-for="post in posts"
        :key="post.id"
        :title="post.title"
        :summary="post.summary"
        :is-open="showArticleSheet && selectedArticle?.post?.id === post.id"
        @click="openArticleSheet(post)"
      >
        <template #visual>
          <div class="media-article-visual">
            <PBadge type="blog">文章</PBadge>
            <img
              v-if="post.cover_url"
              :src="post.cover_url"
              class="media-article-cover"
              :alt="post.title"
            >
            <PAvatar
              v-else
              :src="post.user?.avatar_url"
              :name="postAuthorName(post)"
              size="sm"
              grayscale
            />
          </div>
        </template>
        <template #meta>
          <span v-if="post.channel?.name" class="a-label a-muted">《{{ post.channel.name }}》</span>
          <span v-if="postAuthorName(post)" class="a-muted">{{ postAuthorName(post) }}</span>
          <span v-if="post.created_at" class="a-muted">{{ formatDate(post.created_at) }}</span>
        </template>
      </PEntry>
    </div>
  </div>
</template>

<style scoped>
.media-list-skeleton {
  height: 8rem;
}

.media-explore-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.media-article-list {
  display: flex;
  flex-direction: column;
}

.media-article-visual {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
  flex-shrink: 0;
}

.media-article-cover {
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
  flex-shrink: 0;
  border-radius: 8px;
  margin-top: 0.25rem;
}
</style>
