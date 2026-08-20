<template>
  <div class="a-page-md feed-item-page">
    <!-- Loading -->
    <div v-if="loading" class="feed-loading">
      <div class="a-skeleton" style="height:3rem;width:75%;margin-bottom:1.5rem" />
      <div class="a-skeleton" style="height:1rem;width:40%;margin-bottom:2rem" />
      <div v-for="i in 8" :key="i" class="a-skeleton" style="height:1rem;margin-bottom:1rem" />
    </div>

    <!-- Error state -->
    <div v-else-if="!item" class="feed-error">
      <PEmpty text="内容不存在或已被删除" />
      <div style="text-align:center;margin-top:3rem">
        <RouterLink to="/feed" style="text-decoration:none">
          <PButton variant="secondary" label="← 返回订阅" />
        </RouterLink>
      </div>
    </div>

    <!-- Content -->
    <article v-else class="feed-article">
      <header class="article-header">
        <RouterLink to="/feed" class="back-link"><ArrowLeft :size="16" aria-hidden="true" />返回订阅</RouterLink>
        <h1 class="article-title">{{ item.title }}</h1>
        <div class="article-meta">
          <PBadge type="external">{{ item.feed_source?.title || 'RSS' }}</PBadge>
          <span v-if="item.author" class="author-tag">/ {{ item.author }}</span>
          <span class="date-tag">{{ formatDate(item.published_at) }}</span>
        </div>
      </header>

      <figure v-if="showStandaloneCover" class="article-cover-wrap">
        <img :src="item.image_url" :alt="item.title" class="article-cover-img" />
        <figcaption v-if="item.image_caption" class="article-caption">
          {{ item.image_caption }}
        </figcaption>
      </figure>

      <div
        v-if="(item.enclosure_url && item.enclosure_type?.startsWith('audio/')) || item.duration"
        class="podcast-player-panel"
      >
        <div class="player-label">音频</div>
        <div style="display:flex;align-items:center;gap:1.5rem">
          <PButton
            @click="togglePlay"
            :variant="isPlaying ? 'secondary' : 'primary'"
          >
            <Pause v-if="isPlaying" :size="17" aria-hidden="true" />
            <Play v-else :size="17" aria-hidden="true" />
            {{ isPlaying ? '暂停' : '播放' }}
          </PButton>
          <span v-if="item.duration" class="duration-text">时长 {{ item.duration }}</span>
        </div>
        <audio
          v-if="item.enclosure_url"
          ref="audioRef"
          :src="item.enclosure_url"
          @ended="onEnded"
          style="display:none"
        />
      </div>

      <div class="article-body-wrap">
        <PBadge v-if="item.content_source" :type="item.content_source === 'summary' ? 'external' : 'internal'">
          {{ contentSourceLabel }}
        </PBadge>
        <FeedReaderContent
          class="article-body article-body--external-feed"
          :html="readerHTML"
        />
        <FeedContentFeedback :item-id="item.id" />
      </div>

      <footer class="article-footer">
        <div class="footer-divider"></div>
        <div style="display:flex;gap:1.5rem;justify-content:center;padding:3rem 0">
          <a :href="item.link" target="_blank" rel="noopener noreferrer" class="external-btn" @click="trackOriginalClick">
            <ExternalLink :size="17" aria-hidden="true" />
            查看原文
          </a>
        </div>
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, ExternalLink, Pause, Play } from 'lucide-vue-next'
import { useRoute, RouterLink } from 'vue-router'

import FeedContentFeedback from '@/components/feed/FeedContentFeedback.vue'
import FeedReaderContent from '@/components/feed/FeedReaderContent.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
import PBadge from '@/components/ui/PBadge.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { FeedItem } from '@/types'
import { hasFeedReaderImage } from '@/utils/feedReader'

const route = useRoute()
const api = useApi()
const authStore = useAuthStore()

const loading = ref(true)
const item = ref<FeedItem | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const readerHTML = computed(() => item.value?.content_html || item.value?.content || item.value?.summary || '')
const showStandaloneCover = computed(() => Boolean(item.value?.image_url) && !hasFeedReaderImage(readerHTML.value))

const contentSourceLabel = computed(() => {
  switch (item.value?.content_source) {
    case 'page':
    case 'full_text':
      return '网页正文'
    case 'feed':
      return '订阅正文'
    default:
      return '摘要'
  }
})

const togglePlay = () => {
  if (!audioRef.value || !item.value?.enclosure_url) return

  if (isPlaying.value) {
    audioRef.value.pause()
    isPlaying.value = false
  } else {
    audioRef.value.play()
    isPlaying.value = true
  }
}

const onEnded = () => {
  isPlaying.value = false
}

const reportReadEvent = (eventType: 'detail_open' | 'original_click') => {
  if (!item.value?.feed_source_id) return
  void apiRequestResult(`${api.url}/feed/events/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {}),
    },
    body: JSON.stringify({
      source_type: 'external_rss',
      source_id: item.value.feed_source_id,
      event_type: eventType,
    }),
  }).catch(() => {})
}

const trackOriginalClick = () => {
  reportReadEvent('original_click')
}

const fetchItem = async () => {
  loading.value = true
  try {
    const res = await apiRequestResult(`${api.url}/feed/items/${route.params.id}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })

    if (res.ok) {
      const data = await Promise.resolve(res.data)
      item.value = data.data
      reportReadEvent('detail_open')
    }
  } catch (e) {
    reportError(e, 'Failed to fetch feed item:')
  } finally {
    loading.value = false
  }
}

onMounted(fetchItem)

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause()
  }
})
</script>

<style scoped>
.feed-item-page {
  padding-top: 4rem;
  padding-bottom: 12rem;
}

.back-link {
  font-family: var(--a-font-sans);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-muted);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 2rem;
}

.back-link:hover {
  color: var(--a-color-text);
  text-decoration: underline;
}

.article-title {
  font-family: var(--a-font-sans);
  font-size: 2.75rem;
  font-weight: 600;
  line-height: 1.18;
  max-width: 24ch;
  margin-bottom: 1.5rem;
  color: var(--a-color-text);
  letter-spacing: 0;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem;
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted-soft);
  margin-bottom: 3rem;
}

.author-tag {
  color: var(--a-color-text);
}

.article-cover-wrap {
  margin: 0 0 3.5rem;
}

.article-cover-img {
  width: 100%;
  max-height: 60vh;
  object-fit: contain;
  display: block;
  border: 1px solid var(--a-color-border-soft);
}

.article-caption {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
  margin-top: 0.75rem;
  text-align: center;
  font-style: italic;
}

.podcast-player-panel {
  margin-bottom: 3.5rem;
  padding: 2rem;
  background: var(--a-color-surface);
  border-left: 4px solid var(--a-color-text);
}

.player-label {
  font-family: var(--a-font-sans);
  font-size: 0.65rem;
  font-weight: 500;
  margin-bottom: 1.25rem;
  color: var(--a-color-muted);
  letter-spacing: 0;
}

.duration-text {
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text);
}

.article-body-wrap {
  display: grid;
  gap: 1rem;
  max-width: 100%;
  min-width: 0;
}

.feed-reader-content.article-body {
  margin-bottom: 0;
}

.article-footer {
  margin-top: 5rem;
}

.footer-divider {
  height: 1px;
  border-top: 1px solid var(--a-color-border-soft);
}

.external-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.4rem;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  text-decoration: none;
  font-family: var(--a-font-sans);
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0;
  transition: box-shadow 0.2s;
  box-shadow: none;
}

.external-btn:hover {
  box-shadow: none;
}

.feed-loading {
  display: flex;
  flex-direction: column;
}

@media (max-width: 720px) {
  .article-title {
    font-size: 2rem;
  }
}
</style>
