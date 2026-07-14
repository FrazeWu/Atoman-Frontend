<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import { useApi } from '@/composables/useApi'
import { modulePathUrl } from '@/router/siteUrls'
import type { PodcastEpisode, Post, TimelineItem, Video } from '@/types'

type FeaturedItem =
  | { kind: 'article'; id: string; title: string; meta: string; image?: string; post: Post }
  | { kind: 'podcast'; id: string; title: string; meta: string; image?: string; episode: PodcastEpisode }
  | { kind: 'video'; id: string; title: string; meta: string; image?: string; video: Video }

const featuredKindLabels: Record<FeaturedItem['kind'], string> = {
  article: '文章',
  podcast: '播客',
  video: '视频',
}

const api = useApi()
const router = useRouter()
const posts = ref<Post[]>([])
const episodes = ref<PodcastEpisode[]>([])
const videos = ref<Video[]>([])
const loading = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)
const showArticleSheet = ref(false)

const fmtDate = (value?: string) => {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const fmtDuration = (sec?: number) => {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const episodeCover = (episode: PodcastEpisode) => (
  episode.episode_cover_url
  || episode.post?.collection?.cover_url
  || episode.collections?.[0]?.cover_url
  || episode.channel?.cover_url
  || ''
)

const openArticleSheet = (post: Post) => {
  selectedArticle.value = {
    type: 'post',
    post,
    published_at: post.created_at,
    is_read: false,
  }
  showArticleSheet.value = true
}

const openFeaturedItem = (item: FeaturedItem) => {
  if (item.kind === 'article') {
    openArticleSheet(item.post)
    return
  }
  if (item.kind === 'podcast') {
    void router.push(modulePathUrl('media', `/podcasts/episode/${item.episode.id}`))
    return
  }
  void router.push(modulePathUrl('media', `/videos/watch/${item.video.id}`))
}

const featuredItems = computed<FeaturedItem[]>(() => {
  const combined: Array<FeaturedItem & { stamp: string }> = [
    ...posts.value.map((post) => ({
      kind: 'article' as const,
      id: post.id,
      title: post.title,
      meta: [post.channel?.name, post.user?.display_name || post.user?.username, fmtDate(post.created_at)].filter(Boolean).join(' · '),
      image: post.cover_url,
      post,
      stamp: post.updated_at || post.created_at,
    })),
    ...episodes.value.map((episode) => ({
      kind: 'podcast' as const,
      id: episode.id,
      title: episode.post?.title || '未命名单集',
      meta: [episode.channel?.name, fmtDuration(episode.duration_sec), fmtDate(episode.created_at)].filter(Boolean).join(' · '),
      image: episodeCover(episode),
      episode,
      stamp: episode.updated_at || episode.created_at,
    })),
    ...videos.value.map((video) => ({
      kind: 'video' as const,
      id: video.id,
      title: video.title,
      meta: [fmtDate(video.created_at), typeof video.view_count === 'number' ? `${video.view_count} 次观看` : ''].filter(Boolean).join(' · '),
      image: video.thumbnail_url,
      video,
      stamp: video.updated_at || video.created_at,
    })),
  ]

  return combined
    .sort((a, b) => b.stamp.localeCompare(a.stamp))
    .slice(0, 3)
    .map(({ stamp: _stamp, ...item }) => item)
})

const loadHome = async () => {
  loading.value = true
  try {
    const articleUrl = `${api.blog.posts}?${new URLSearchParams({ page: '1', page_size: '6', sort: 'latest' })}`
    const podcastUrl = `${api.podcast.episodes}?${new URLSearchParams({ sort: 'latest', limit: '6' })}`
    const videoUrl = `${api.videos.list}?${new URLSearchParams({ sort: 'latest', limit: '6' })}`

    const [articleRes, podcastRes, videoRes] = await Promise.all([
      fetch(articleUrl),
      fetch(podcastUrl),
      fetch(videoUrl),
    ])

    const [articleData, podcastData, videoData] = await Promise.all([
      articleRes.ok ? articleRes.json() : [],
      podcastRes.ok ? podcastRes.json() : [],
      videoRes.ok ? videoRes.json() : [],
    ])

    const articleRows = Array.isArray(articleData)
      ? articleData
      : (Array.isArray(articleData?.data) ? articleData.data : [])
    posts.value = articleRows.map((item: any) => item.post || item).filter(Boolean)
    episodes.value = Array.isArray(podcastData)
      ? podcastData
      : (Array.isArray(podcastData?.data) ? podcastData.data : (Array.isArray(podcastData?.episodes) ? podcastData.episodes : []))
    videos.value = Array.isArray(videoData)
      ? videoData
      : (Array.isArray(videoData?.data) ? videoData.data : [])
  } finally {
    loading.value = false
  }
}

onMounted(loadHome)
</script>

<template>
  <div class="a-page-xl content-home">
    <FeedArticleSheet :show="showArticleSheet" :article="selectedArticle" @close="showArticleSheet = false" />

    <PPageHeader title="内容" accent>
      <template #action>
        <PButton :to="modulePathUrl('media', '/create')" outline size="sm">进入创作</PButton>
      </template>
    </PPageHeader>

    <section data-testid="content-home-hero" class="content-home-hero">
      <button
        v-for="(item, index) in featuredItems"
        :key="item.id"
        :data-testid="`content-home-feature-${index}`"
        class="content-home-feature"
        :class="{ 'content-home-feature--primary': index === 0 }"
        type="button"
        @click="openFeaturedItem(item)"
      >
        <div v-if="item.image" class="content-home-feature__image" :style="{ backgroundImage: `url(${item.image})` }" />
        <div v-else class="content-home-feature__image content-home-feature__image--empty">{{ featuredKindLabels[item.kind] }}</div>
        <div class="content-home-feature__body">
          <PBadge :type="item.kind === 'article' ? 'blog' : item.kind === 'podcast' ? 'podcast' : 'video'">
            {{ item.kind === 'article' ? '文章' : item.kind === 'podcast' ? '播客' : '视频' }}
          </PBadge>
          <h2>{{ item.title }}</h2>
          <p class="a-muted">{{ item.meta }}</p>
        </div>
      </button>
    </section>

    <div v-if="loading" class="a-skeleton content-home-skeleton" />

    <template v-else>
      <section class="content-home-section">
        <div class="content-home-section__head">
          <h2>文章</h2>
          <PButton :to="modulePathUrl('media', '/articles')" variant="ghost" size="sm">查看全部</PButton>
        </div>
        <PEmpty v-if="posts.length === 0" title="暂无文章" />
        <div class="content-home-list">
          <PEntry
            v-for="post in posts.slice(0, 4)"
            :key="post.id"
            :title="post.title"
            :summary="post.summary"
            @click="openArticleSheet(post)"
          >
            <template #visual>
              <div class="content-home-list__visual">
                <PBadge type="blog">文章</PBadge>
                <img v-if="post.cover_url" :src="post.cover_url" class="content-home-cover" :alt="post.title">
                <PAvatar
                  v-else
                  :src="post.user?.avatar_url"
                  :name="post.user?.display_name || post.user?.username || ''"
                  size="sm"
                  grayscale
                />
              </div>
            </template>
            <template #meta>
              <span v-if="post.channel?.name" class="a-label a-muted">《{{ post.channel.name }}》</span>
              <span v-if="post.user?.display_name || post.user?.username" class="a-muted">{{ post.user?.display_name || post.user?.username }}</span>
              <span class="a-muted">{{ fmtDate(post.created_at) }}</span>
            </template>
          </PEntry>
        </div>
      </section>

      <section class="content-home-section">
        <div class="content-home-section__head">
          <h2>播客</h2>
          <PButton :to="modulePathUrl('media', '/podcasts')" variant="ghost" size="sm">查看全部</PButton>
        </div>
        <PEmpty v-if="episodes.length === 0" title="暂无播客" />
        <div class="content-home-list">
          <PEntry
            v-for="episode in episodes.slice(0, 4)"
            :key="episode.id"
            :title="episode.post?.title || '未命名单集'"
            :summary="episode.post?.summary"
            :to="modulePathUrl('media', `/podcasts/episode/${episode.id}`)"
          >
            <template #visual>
              <div class="content-home-list__visual">
                <PBadge type="podcast">播客</PBadge>
                <img v-if="episodeCover(episode)" :src="episodeCover(episode)" class="content-home-cover" :alt="episode.post?.title || '播客封面'">
              </div>
            </template>
            <template #meta>
              <span v-if="episode.channel?.name" class="a-label a-muted">{{ episode.channel.name }}</span>
              <span v-if="episode.duration_sec" class="a-muted">{{ fmtDuration(episode.duration_sec) }}</span>
              <span class="a-muted">{{ fmtDate(episode.created_at) }}</span>
            </template>
          </PEntry>
        </div>
      </section>

      <section class="content-home-section">
        <div class="content-home-section__head">
          <h2>视频</h2>
          <PButton :to="modulePathUrl('media', '/videos')" variant="ghost" size="sm">查看全部</PButton>
        </div>
        <PEmpty v-if="videos.length === 0" title="暂无视频" />
        <div class="content-home-video-grid">
          <PVideoCard
            v-for="video in videos.slice(0, 4)"
            :key="video.id"
            :video="video"
            :to="modulePathUrl('media', `/videos/watch/${video.id}`)"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.content-home-hero {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap: 1rem;
  margin-bottom: 2rem;
}

.content-home-feature {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  padding: 0;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}

.content-home-feature--primary {
  min-height: 24rem;
}

.content-home-feature__image {
  min-height: 12rem;
  background-size: cover;
  background-position: center;
  background-color: var(--a-color-paper-wash);
}

.content-home-feature__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.content-home-feature__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.content-home-feature__body h2 {
  margin: 0;
  font-size: 1.4rem;
  line-height: 1.15;
}

.content-home-section {
  margin-top: 2.5rem;
}

.content-home-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.content-home-section__head h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 900;
}

.content-home-list {
  display: flex;
  flex-direction: column;
}

.content-home-list__visual {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-start;
}

.content-home-cover {
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 8px;
}

.content-home-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

.content-home-skeleton {
  height: 12rem;
}

@media (max-width: 960px) {
  .content-home-hero {
    grid-template-columns: 1fr;
  }

  .content-home-feature--primary {
    min-height: 0;
  }
}

@media (max-width: 767px) {
  .content-home-feature:not(:first-child) {
    display: none;
  }

  .content-home-feature__image {
    min-height: 10rem;
  }
}
</style>
