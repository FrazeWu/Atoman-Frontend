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
      <AEmpty text="内容不存在或已被删除" />
      <div style="text-align:center;margin-top:3rem">
        <RouterLink to="/" style="text-decoration:none">
          <PaperPress variant="secondary" label="← 返回订阅" />
        </RouterLink>
      </div>
    </div>

    <!-- Content -->
    <article v-else class="feed-article">
      <header class="article-header">
        <RouterLink to="/" class="back-link">← BACK TO FEED</RouterLink>
        <h1 class="article-title">{{ item.title }}</h1>
        <div class="article-meta">
          <PaperBadge type="external">{{ item.feed_source?.title || 'RSS' }}</PaperBadge>
          <span v-if="item.author" class="author-tag">/ {{ item.author }}</span>
          <span class="date-tag">{{ formatDate(item.published_at) }}</span>
        </div>
      </header>

      <figure v-if="item.image_url" class="article-cover-wrap">
        <img :src="item.image_url" :alt="item.title" class="article-cover-img" />
        <figcaption v-if="item.image_caption" class="article-caption">
          {{ item.image_caption }}
        </figcaption>
      </figure>

      <div
        v-if="(item.enclosure_url && item.enclosure_type?.startsWith('audio/')) || item.duration"
        class="podcast-player-panel"
      >
        <div class="player-label">AUDIO_ENCLOSURE</div>
        <div style="display:flex;align-items:center;gap:1.5rem">
          <PaperPress
            @click="togglePlay"
            :label="isPlaying ? '⏸ PAUSE' : '▶ PLAY AUDIO'"
            :variant="isPlaying ? 'secondary' : 'primary'"
          />
          <span v-if="item.duration" class="duration-text">DURATION: {{ item.duration }}</span>
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
        <PaperBadge v-if="item.content_source" :type="item.content_source === 'full_text' ? 'internal' : 'external'">
          {{ item.content_source === 'full_text' ? 'FULL TEXT' : 'SUMMARY' }}
        </PaperBadge>
        <div class="prose-blog article-body" v-html="renderContent(item.content_html || item.content || item.summary || '')"></div>
      </div>

      <footer class="article-footer">
        <div class="footer-divider"></div>
        <div style="display:flex;gap:1.5rem;justify-content:center;padding:3rem 0">
          <a :href="item.link" target="_blank" rel="noopener noreferrer" class="external-btn">
            ↗ VIEW ORIGINAL SOURCE
          </a>
        </div>
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import DOMPurify from 'dompurify'

import AEmpty from '@/components/ui/AEmpty.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperBadge from '@/components/ui/PaperBadge.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { FeedItem } from '@/types'

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

const renderContent = (html: string) => {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  })
  return clean.replace(/<img/g, '<img style="max-width:100%;height:auto;border:1px solid var(--a-color-line-soft);margin:2rem 0"')
}

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

const fetchItem = async () => {
  loading.value = true
  try {
    const res = await fetch(`${api.url}/feed/items/${route.params.id}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })

    if (res.ok) {
      const data = await res.json()
      item.value = data.data
    }
  } catch (e) {
    console.error('Failed to fetch feed item:', e)
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
  font-family: var(--a-font-meta);
  font-size: 0.7rem;
  font-weight: 950;
  letter-spacing: 0.15em;
  color: var(--a-color-muted);
  text-decoration: none;
  display: inline-block;
  margin-bottom: 2rem;
}

.back-link:hover {
  color: var(--a-color-ink);
  text-decoration: underline;
}

.article-title {
  font-family: var(--a-font-serif);
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 900;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  color: var(--a-color-ink);
  letter-spacing: -0.04em;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem;
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--a-color-muted-soft);
  margin-bottom: 3rem;
}

.author-tag {
  color: var(--a-color-ink);
}

.article-cover-wrap {
  margin: 0 0 3.5rem;
}

.article-cover-img {
  width: 100%;
  max-height: 60vh;
  object-fit: cover;
  display: block;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
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
  background: var(--a-color-paper-soft);
  border-left: 4px solid var(--a-color-ink);
}

.player-label {
  font-family: var(--a-font-meta);
  font-size: 0.65rem;
  font-weight: 950;
  margin-bottom: 1.25rem;
  color: var(--a-color-muted);
  letter-spacing: 0.1em;
}

.duration-text {
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 900;
  color: var(--a-color-ink);
}

.article-body-wrap {
  display: grid;
  gap: 1rem;
}

.article-body {
  font-size: 1rem;
}

.article-footer {
  margin-top: 5rem;
}

.footer-divider {
  height: 1px;
  border-top: 1.5px dashed var(--a-color-line-soft);
}

.external-btn {
  display: inline-block;
  padding: 1.25rem 2.5rem;
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  text-decoration: none;
  font-family: var(--a-font-meta);
  font-size: 0.85rem;
  font-weight: 950;
  letter-spacing: 0.15em;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 8px 8px 0 rgba(0,0,0,0.1);
}

.external-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 12px 12px 0 rgba(0,0,0,0.15);
}

.feed-loading {
  display: flex;
  flex-direction: column;
}
</style>
