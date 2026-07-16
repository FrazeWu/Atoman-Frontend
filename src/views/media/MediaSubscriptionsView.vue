<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { modulePathUrl } from '@/router/siteUrls'
import type { Post, TimelineItem, Video } from '@/types'

type SubscriptionFilter = 'all' | 'article' | 'podcast' | 'video'
type SubscriptionKind = Exclude<SubscriptionFilter, 'all'>

type InternalPostSubscriptionItem = {
  id: string
  kind: Exclude<SubscriptionKind, 'video'>
  post: Post
  publishedAt: string
}

type InternalVideoSubscriptionItem = {
  id: string
  kind: 'video'
  video: Video
  publishedAt: string
}

type InternalSubscriptionItem = InternalPostSubscriptionItem | InternalVideoSubscriptionItem

const api = useApi()
const authStore = useAuthStore()
const loading = ref(false)
const errorMessage = ref('')
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

const normalizePostKind = (post: Post): InternalPostSubscriptionItem['kind'] =>
  post.channel?.content_type === 'podcast' ? 'podcast' : 'article'

const toInternalItem = (item: TimelineItem): InternalSubscriptionItem | null => {
  if (item.type !== 'post' || !item.post) return null
  return {
    id: item.post.id,
    kind: normalizePostKind(item.post),
    post: item.post,
    publishedAt: item.published_at || item.post.created_at,
  }
}

const toVideoItem = (video: Video): InternalVideoSubscriptionItem => ({
  id: video.id,
  kind: 'video',
  video,
  publishedAt: video.created_at,
})

const loadSubscriptions = async () => {
  if (!authStore.isAuthenticated || !authStore.token) {
    items.value = []
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const headers = { Authorization: `Bearer ${authStore.token}` }
    const [timelineRes, videosRes] = await Promise.all([
      fetch(api.feed.timeline, { headers }),
      fetch(`${api.url}/videos?subscribed=true&sort=latest`, { headers }),
    ])
    if (!timelineRes.ok || !videosRes.ok) throw new Error('Subscription request failed')

    const [timelineData, videosData] = await Promise.all([timelineRes.json(), videosRes.json()])
    if (
      !timelineData
      || typeof timelineData !== 'object'
      || Array.isArray(timelineData)
      || !Array.isArray(timelineData.data)
      || !Array.isArray(videosData)
    ) {
      throw new Error('Invalid subscription response')
    }

    const timelineMeta = timelineData.meta
    if (
      !timelineMeta
      || typeof timelineMeta !== 'object'
      || Array.isArray(timelineMeta)
      || !Number.isInteger(timelineMeta.page)
      || timelineMeta.page < 1
      || !Number.isInteger(timelineMeta.page_size)
      || timelineMeta.page_size < 1
      || timelineMeta.page_size > 100
      || !Number.isInteger(timelineMeta.total)
      || timelineMeta.total < 0
      || typeof timelineMeta.has_more !== 'boolean'
    ) {
      throw new Error('Invalid subscription response')
    }

    const timelineRows = timelineData.data
    const videoRows = videosData
    const postItems = timelineRows
      .map((item: TimelineItem) => toInternalItem(item))
      .filter((item: InternalSubscriptionItem | null): item is InternalSubscriptionItem => Boolean(item))
    items.value = [...postItems, ...videoRows.map((video: Video) => toVideoItem(video))]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  } catch (error) {
    console.error('Failed to load media subscriptions:', error)
    items.value = []
    errorMessage.value = '订阅加载失败'
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
  return '暂无更新'
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

    <PPageHeader title="订阅" accent />

    <section class="media-subscriptions-toolbar" aria-label="订阅内容筛选">
      <PSegmentedControl v-model="activeFilter" :options="filterOptions" />
    </section>

    <div v-if="loading" class="a-skeleton media-subscriptions-skeleton" />

    <p v-else-if="errorMessage" class="media-subscriptions-error">{{ errorMessage }}</p>

    <PEmpty
      v-else-if="visibleItems.length === 0"
      :text="emptyText"
    />

    <div v-else class="media-subscriptions-list">
      <template v-for="item in visibleItems" :key="`${item.kind}:${item.id}`">
        <div v-if="item.kind === 'video'" class="media-subscriptions-video-card">
          <PVideoCard
            :video="item.video"
            :to="modulePathUrl('media', `/videos/watch/${item.video.id}`)"
          />
        </div>

        <PEntry
          v-else
          :title="item.post.title"
          :summary="item.post.summary"
          :is-open="showArticleSheet && selectedArticle?.post?.id === item.post.id"
          @click="openArticleSheet(item.post)"
        >
          <template #visual>
            <div class="media-subscriptions-visual">
              <PBadge :type="item.kind === 'podcast' ? 'podcast' : 'blog'">
                {{ item.kind === 'podcast' ? '播客' : '文章' }}
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
      </template>
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

.media-subscriptions-video-card {
  max-width: 24rem;
  padding: 1rem 0;
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
