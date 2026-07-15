<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useApi } from '@/composables/useApi'
import { useRouter } from 'vue-router'
import { modulePathUrl } from '@/router/siteUrls'
import { useAuthStore } from '@/stores/auth'
import type { Channel, PodcastEpisode, Post, Video } from '@/types'

type BookmarkMode = 'content' | 'container'
type ContentFilter = 'all' | 'article' | 'video' | 'podcast'
type ContainerFilter = 'all' | 'video_channel' | 'podcast_show'

type ArticleBookmark = {
  id: string
  post_id: string
  post?: Post
}

type VideoBookmark = {
  id: string
  video_id: string
  video?: Video
}

type PodcastEpisodeBookmark = {
  id: string
  episode_id: string
  episode?: PodcastEpisode
}

type ChannelBookmark = {
  id: string
  channel_id: string
  kind?: 'video_channel' | 'podcast_show'
  channel?: Channel
}

type ContentBookmarkItem =
  | { id: string; kind: 'article'; post: Post }
  | { id: string; kind: 'video'; video: Video }
  | { id: string; kind: 'podcast'; episode: PodcastEpisode }

type ContainerBookmarkItem = {
  id: string
  kind: 'video_channel' | 'podcast_show'
  channel: Channel
}

const api = useApi()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const errorMessage = ref('')
const mode = ref<BookmarkMode>('content')
const contentFilter = ref<ContentFilter>('all')
const containerFilter = ref<ContainerFilter>('all')

const contentItems = ref<ContentBookmarkItem[]>([])
const containerItems = ref<ContainerBookmarkItem[]>([])

const modeOptions = [
  { label: '内容', value: 'content' },
  { label: '容器', value: 'container' },
] satisfies Array<{ label: string; value: BookmarkMode }>

const contentOptions = [
  { label: '全部', value: 'all' },
  { label: '文章', value: 'article' },
  { label: '视频', value: 'video' },
  { label: '播客', value: 'podcast' },
] satisfies Array<{ label: string; value: ContentFilter }>

const containerOptions = [
  { label: '全部', value: 'all' },
  { label: '视频频道', value: 'video_channel' },
  { label: '播客节目', value: 'podcast_show' },
] satisfies Array<{ label: string; value: ContainerFilter }>

const formatDate = (value?: string) => {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const fmtDuration = (sec?: number) => {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const authorName = (post: Post) => post.user?.display_name || post.user?.username || ''

const episodeTitle = (episode: PodcastEpisode) => episode.post?.title || '未命名单集'

const visibleContentItems = computed(() => {
  if (contentFilter.value === 'all') return contentItems.value
  return contentItems.value.filter((item) => item.kind === contentFilter.value)
})

const visibleContainerItems = computed(() => {
  if (containerFilter.value === 'all') return containerItems.value
  return containerItems.value.filter((item) => item.kind === containerFilter.value)
})

const emptyText = computed(() => {
  if (mode.value === 'content') {
    if (contentFilter.value === 'article') return '暂无文章收藏'
    if (contentFilter.value === 'video') return '暂无视频收藏'
    if (contentFilter.value === 'podcast') return '暂无播客收藏'
    return '暂无内容收藏'
  }

  if (containerFilter.value === 'video_channel') return '暂无视频频道收藏'
  if (containerFilter.value === 'podcast_show') return '暂无播客节目收藏'
  return '暂无容器收藏'
})

const loadBookmarks = async () => {
  if (!authStore.isAuthenticated || !authStore.token) {
    contentItems.value = []
    containerItems.value = []
    errorMessage.value = ''
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const requestInit = {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    }
    const [articleRes, videoRes, podcastRes, videoChannelRes, podcastShowRes] = await Promise.all([
      fetch(api.blog.bookmarks, requestInit),
      fetch(`${api.url}/videos/bookmarks`, requestInit),
      fetch(`${api.url}/podcast/bookmarks`, requestInit),
      fetch(`${api.url}/videos/channel-bookmarks`, requestInit),
      fetch(`${api.url}/podcast/show-bookmarks`, requestInit),
    ])

    if ([articleRes, videoRes, podcastRes, videoChannelRes, podcastShowRes].some((response) => !response.ok)) {
      throw new Error('收藏加载失败')
    }

    const [articleData, videoData, podcastData, videoChannelData, podcastShowData] = await Promise.all([
      articleRes.json(),
      videoRes.json(),
      podcastRes.json(),
      videoChannelRes.json(),
      podcastShowRes.json(),
    ])

    const articleBookmarks = ((articleData.data || []) as ArticleBookmark[])
      .filter((bookmark) => bookmark.post)
      .map((bookmark) => ({ id: bookmark.id, kind: 'article' as const, post: bookmark.post! }))

    const videoBookmarks = ((videoData.data || []) as VideoBookmark[])
      .filter((bookmark) => bookmark.video)
      .map((bookmark) => ({ id: bookmark.id, kind: 'video' as const, video: bookmark.video! }))

    const podcastBookmarks = ((podcastData.data || []) as PodcastEpisodeBookmark[])
      .filter((bookmark) => bookmark.episode)
      .map((bookmark) => ({ id: bookmark.id, kind: 'podcast' as const, episode: bookmark.episode! }))

    contentItems.value = [...articleBookmarks, ...videoBookmarks, ...podcastBookmarks]

    const videoChannelBookmarks = ((videoChannelData.data || []) as ChannelBookmark[])
      .filter((bookmark) => bookmark.channel)
      .map((bookmark) => ({ id: bookmark.id, kind: 'video_channel' as const, channel: bookmark.channel! }))

    const podcastShowBookmarks = ((podcastShowData.data || []) as ChannelBookmark[])
      .filter((bookmark) => bookmark.channel)
      .map((bookmark) => ({ id: bookmark.id, kind: 'podcast_show' as const, channel: bookmark.channel! }))

    containerItems.value = [...videoChannelBookmarks, ...podcastShowBookmarks]
  } catch (error) {
    console.error('Failed to load media bookmarks:', error)
    contentItems.value = []
    containerItems.value = []
    errorMessage.value = '收藏加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadBookmarks)
</script>

<template>
  <div class="a-page-xl media-bookmarks-view">
    <PPageHeader title="收藏" accent />

    <section class="media-bookmarks-toolbar">
      <PSegmentedControl v-model="mode" :options="modeOptions" />
      <PSegmentedControl
        v-if="mode === 'content'"
        v-model="contentFilter"
        :options="contentOptions"
      />
      <PSegmentedControl
        v-else
        v-model="containerFilter"
        :options="containerOptions"
      />
    </section>

    <div v-if="loading" class="a-skeleton media-bookmarks-skeleton" />

    <p v-else-if="errorMessage" class="media-bookmarks-error">{{ errorMessage }}</p>

    <PEmpty
      v-else-if="mode === 'content' ? visibleContentItems.length === 0 : visibleContainerItems.length === 0"
      :text="emptyText"
    />

    <div v-else-if="mode === 'content'" class="media-bookmarks-content">
      <template v-for="item in visibleContentItems" :key="item.id">
        <PEntry
          v-if="item.kind === 'article'"
          :title="item.post.title"
          :summary="item.post.summary"
          @click="router.push(`/posts/post/${item.post.id}`)"
        >
          <template #visual>
            <div class="media-bookmarks-visual">
              <PBadge type="blog">文章</PBadge>
              <img
                v-if="item.post.cover_url"
                :src="item.post.cover_url"
                class="media-bookmarks-cover"
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
            <span class="a-muted">{{ formatDate(item.post.created_at) }}</span>
          </template>
        </PEntry>

        <div v-else-if="item.kind === 'video'" class="media-bookmarks-video-card">
          <PVideoCard :video="item.video" :to="modulePathUrl('media', `/videos/watch/${item.video.id}`)" />
        </div>

        <PEntry
          v-else
          :title="episodeTitle(item.episode)"
          :summary="item.episode.post?.summary"
          @click="router.push(modulePathUrl('media', `/podcasts/episode/${item.episode.id}`))"
        >
          <template #visual>
            <div class="media-bookmarks-visual">
              <PBadge type="podcast">播客</PBadge>
            </div>
          </template>
          <template #meta>
            <span v-if="item.episode.channel?.name" class="a-label a-muted">{{ item.episode.channel.name }}</span>
            <span v-if="item.episode.duration_sec" class="a-muted">时长: {{ fmtDuration(item.episode.duration_sec) }}</span>
            <span class="a-muted">{{ formatDate(item.episode.created_at) }}</span>
          </template>
        </PEntry>
      </template>
    </div>

    <div v-else class="media-bookmarks-container-list">
      <PEntry
        v-for="item in visibleContainerItems"
        :key="item.id"
        :title="item.channel.name"
        :summary="item.kind === 'video_channel' ? '视频频道收藏' : '播客节目收藏'"
        @click="router.push(item.kind === 'video_channel' ? `/videos?channel_id=${encodeURIComponent(item.channel.id)}` : `/podcasts/show/${item.channel.slug}`)"
      >
        <template #visual>
          <div class="media-bookmarks-visual">
            <PBadge :type="item.kind === 'video_channel' ? 'video' : 'podcast'">
              {{ item.kind === 'video_channel' ? '视频频道' : '播客节目' }}
            </PBadge>
          </div>
        </template>
        <template #meta>
          <span class="a-muted">{{ item.channel.slug }}</span>
          <span class="a-muted">{{ formatDate(item.channel.created_at) }}</span>
        </template>
      </PEntry>
    </div>
  </div>
</template>

<style scoped>
.media-bookmarks-view {
  min-height: 100%;
}

.media-bookmarks-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin: 1rem 0 1.5rem;
}

.media-bookmarks-skeleton {
  height: 8rem;
}

.media-bookmarks-error {
  margin: 0 0 1rem;
  color: #b42318;
}

.media-bookmarks-content,
.media-bookmarks-container-list {
  display: flex;
  flex-direction: column;
}

.media-bookmarks-visual {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
  flex-shrink: 0;
}

.media-bookmarks-cover {
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
  flex-shrink: 0;
  border-radius: 8px;
  margin-top: 0.25rem;
}

.media-bookmarks-video-card {
  padding: 0.5rem 0;
}
</style>
