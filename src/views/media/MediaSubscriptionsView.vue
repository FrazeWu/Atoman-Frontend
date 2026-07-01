<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { Post, TimelineItem } from '@/types'

type SubscriptionFilter = 'all' | 'article' | 'podcast' | 'video'
type SubscriptionKind = Exclude<SubscriptionFilter, 'all'>

type InternalSubscriptionItem = {
  id: string
  kind: SubscriptionKind
  post: Post
  publishedAt: string
}

const api = useApi()
const authStore = useAuthStore()
const loading = ref(false)
const items = ref<InternalSubscriptionItem[]>([])
const activeFilter = ref<SubscriptionFilter>('all')
const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)

const filterOptions: Array<{ label: string; value: SubscriptionFilter }> = [
  { label: '全部', value: 'all' },
  { label: '文章', value: 'article' },
  { label: '播客', value: 'podcast' },
  { label: '视频', value: 'video' },
]

const normalizeKind = (post: Post): SubscriptionKind => {
  const collectionType = post.collections
    ?.map((collection) => (collection as { type?: unknown }).type)
    .find((type): type is SubscriptionKind => type === 'podcast' || type === 'video')
  if (collectionType === 'podcast' || collectionType === 'video') return collectionType

  const collectionName = (post.collections || [])
    .map((collection) => collection.name?.trim().toLowerCase() || '')
    .find(Boolean) || ''

  if (collectionName.includes('podcast') || collectionName.includes('播客')) return 'podcast'
  if (collectionName.includes('video') || collectionName.includes('视频')) return 'video'
  return 'article'
}

const toInternalItem = (item: TimelineItem): InternalSubscriptionItem | null => {
  if (item.type !== 'post' || !item.post) return null
  return {
    id: item.post.id,
    kind: normalizeKind(item.post),
    post: item.post,
    publishedAt: item.published_at || item.post.created_at,
  }
}

const loadSubscriptions = async () => {
  if (!authStore.isAuthenticated || !authStore.token) {
    items.value = []
    return
  }

  loading.value = true
  try {
    const res = await fetch(api.feed.timeline, {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    })
    if (!res.ok) {
      items.value = []
      return
    }
    const data = await res.json()
    const rows = Array.isArray(data?.data) ? data.data : []
    items.value = rows
      .map((item: TimelineItem) => toInternalItem(item))
      .filter((item: InternalSubscriptionItem | null): item is InternalSubscriptionItem => Boolean(item))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  } finally {
    loading.value = false
  }
}

const visibleItems = computed(() => {
  if (activeFilter.value === 'all') return items.value
  return items.value.filter((item) => item.kind === activeFilter.value)
})

const emptyText = computed(() => {
  if (activeFilter.value === 'article') return '暂无文章'
  if (activeFilter.value === 'podcast') return '暂无播客'
  if (activeFilter.value === 'video') return '暂无视频'
  return '暂无订阅内容'
})

const formatDate = (value?: string) => {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const authorName = (post: Post) => post.user?.display_name || post.user?.username || ''

const openArticleSheet = (post: Post) => {
  selectedArticle.value = {
    type: 'post',
    post,
    published_at: post.created_at,
    is_read: false,
  }
  showArticleSheet.value = true
}

onMounted(loadSubscriptions)
</script>

<template>
  <div class="a-page-xl media-subscriptions-view">
    <FeedArticleSheet :show="showArticleSheet" :article="selectedArticle" @close="showArticleSheet = false" />

    <PPageHeader title="订阅" sub="查看你在全站范围内关注的内容更新，不限定当前频道。" accent />

    <section class="media-subscriptions-toolbar" aria-label="订阅内容筛选">
      <PSegmentedControl v-model="activeFilter" :options="filterOptions" />
    </section>

    <div v-if="loading" class="a-skeleton media-subscriptions-skeleton" />

    <PEmpty
      v-else-if="visibleItems.length === 0"
      :text="emptyText"
      sub="这里只展示站内订阅内容，不包含 RSS 或外部 feed item。"
    />

    <div v-else class="media-subscriptions-list">
      <PEntry
        v-for="item in visibleItems"
        :key="item.id"
        :title="item.post.title"
        :summary="item.post.summary"
        :is-open="showArticleSheet && selectedArticle?.post?.id === item.post.id"
        @click="openArticleSheet(item.post)"
      >
        <template #visual>
          <div class="media-subscriptions-visual">
            <PBadge type="internal" fill>内部</PBadge>
            <PBadge :type="item.kind === 'podcast' ? 'podcast' : item.kind === 'video' ? 'video' : 'blog'">
              {{ item.kind === 'podcast' ? '播客' : item.kind === 'video' ? '视频' : '文章' }}
            </PBadge>
            <img
              v-if="item.post.cover_url"
              :src="item.post.cover_url"
              class="media-subscriptions-cover"
              :alt="item.post.title"
            >
            <PAvatar
              v-else
              :src="item.post.user?.avatar_url"
              :name="authorName(item.post)"
              size="sm"
              grayscale
            />
          </div>
        </template>
        <template #meta>
          <span v-if="item.post.channel?.name" class="a-label a-muted">《{{ item.post.channel.name }}》</span>
          <span v-if="authorName(item.post)" class="a-muted">{{ authorName(item.post) }}</span>
          <span class="a-muted">{{ formatDate(item.publishedAt) }}</span>
        </template>
      </PEntry>
    </div>
  </div>
</template>

<style scoped>
.media-subscriptions-view {
  min-height: 100%;
}

.media-subscriptions-toolbar {
  display: flex;
  align-items: center;
  margin: 1rem 0 1.5rem;
}

.media-subscriptions-skeleton {
  height: 8rem;
}

.media-subscriptions-list {
  display: flex;
  flex-direction: column;
}

.media-subscriptions-visual {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
  flex-shrink: 0;
}

.media-subscriptions-cover {
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
