<script setup lang="ts">
import { IconClock as Clock3, IconPlayerPlay as Play } from '@tabler/icons-vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useVideoBookmarks } from '@/composables/useVideoBookmarks'
import PMediaCard from '@/components/ui/PMediaCard.vue'
import { useAuthStore } from '@/stores/auth'
import type { Video } from '@/types'
import { resolveMediaURL } from '@/utils/mediaUrl'

const props = defineProps<{
  video: Video
  to?: string
}>()

const router = useRouter()
const authStore = useAuthStore()
const bookmarks = useVideoBookmarks()
const avatarUrl = computed(() => {
  const url = props.video.channel?.cover_url?.trim() || props.video.user?.avatar_url?.trim() || ''
  return url ? resolveMediaURL(url) : ''
})

async function toggleWatchLater() {
  if (!authStore.isAuthenticated) {
    await router.push('/login')
    return
  }
  await bookmarks.toggle(String(props.video.id))
}

function fmtDuration(sec: number): string {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}

function fmtDate(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const avatarLetter = () =>
  (props.video.channel?.name ?? props.video.user?.username ?? '?')[0].toUpperCase()
</script>

<template>
  <PMediaCard variant="landscape" class="vc-card">
    <div class="vc-thumb">
      <RouterLink :to="to || `/videos/watch/${video.id}`" class="vc-thumb-link" :aria-label="video.title">
        <img v-if="video.thumbnail_url" :src="video.thumbnail_url" :alt="video.title" class="vc-img" loading="lazy" />
        <div v-else class="vc-thumb-placeholder"><Play :size="28" aria-hidden="true" /></div>

        <!-- 悬浮微渐变与居中播放徽标 -->
        <div class="vc-play-overlay">
          <span class="vc-play-badge">
            <Play :size="18" fill="currentColor" aria-hidden="true" />
          </span>
        </div>

        <span class="vc-play-count"><Play :size="11" aria-hidden="true" />{{ fmtViews(video.view_count) }}</span>
        <span v-if="video.duration_sec" class="vc-duration">{{ fmtDuration(video.duration_sec) }}</span>
      </RouterLink>
      <button
        type="button"
        class="vc-watch-later"
        :class="{ 'is-active': bookmarks.isBookmarked(String(video.id)) }"
        :disabled="bookmarks.isPending(String(video.id))"
        :aria-label="`${bookmarks.isBookmarked(String(video.id)) ? '取消稍后看' : '稍后看'} ${video.title}`"
        :title="bookmarks.isBookmarked(String(video.id)) ? '取消稍后看' : '稍后看'"
        @click="toggleWatchLater"
      >
        <Clock3 :size="18" aria-hidden="true" />
      </button>
    </div>

    <RouterLink :to="to || `/videos/watch/${video.id}`" class="vc-info">
      <div class="vc-avatar" aria-hidden="true">
        <img v-if="avatarUrl" :src="avatarUrl" :alt="video.channel?.name || video.user?.username || ''" />
        <span v-else>{{ avatarLetter() }}</span>
      </div>
      <div class="vc-text">
        <h3 class="vc-title a-clamp-2">{{ video.title }}</h3>
        <div class="vc-meta">
          <span v-if="video.channel" class="vc-channel">《{{ video.channel.name }}》</span>
          <div class="vc-stats">
            <span>{{ fmtDate(video.created_at) }}</span>
          </div>
        </div>
      </div>
    </RouterLink>
  </PMediaCard>
</template>

<style scoped>
/* Thumbnail */
.vc-thumb {
  position: relative;
  aspect-ratio: 16/9;
  background: var(--a-color-surface-muted, #18181b);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  transition: border-color 0.2s ease;
}

.vc-card:hover .vc-thumb {
  border-color: color-mix(in srgb, var(--a-color-primary, #2563eb) 35%, var(--a-color-border-soft));
}

.vc-thumb-link { display: block; width: 100%; height: 100%; color: inherit; position: relative; }
.vc-card:hover .vc-img { transform: scale(1.04); }
.vc-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  display: block;
}
.vc-thumb-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted);
}

.vc-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.18);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.vc-play-badge {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  transform: scale(0.9);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.vc-card:hover .vc-play-overlay {
  opacity: 1;
}

.vc-card:hover .vc-play-badge {
  transform: scale(1);
}

.vc-watch-later {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  opacity: 0;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-pill, 999px);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.15s ease;
}

.vc-card:hover .vc-watch-later,
.vc-card:focus-within .vc-watch-later {
  opacity: 1;
}

.vc-play-count {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: var(--a-radius-control);
}

.vc-duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: var(--a-radius-control);
  z-index: 1;
}

/* Info */
.vc-info {
  display: flex;
  gap: 12px;
  padding: 12px 0 0;
  color: inherit;
  text-decoration: none;
}
.vc-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: #fff;
}
.vc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.vc-text { min-width: 0; flex: 1; }
.vc-title {
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.35;
  color: var(--a-color-fg);
  margin: 0 0 0.35rem 0;
  transition: color 0.2s;
}

.vc-card:hover .vc-title,
.vc-card:focus-within .vc-title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.vc-meta {
  font-family: var(--a-font-sans);
  font-size: 0.725rem;
  color: var(--a-color-muted-soft);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.vc-channel {
  color: var(--a-color-muted);
  font-weight: 500;
  letter-spacing: 0;
}
.vc-stats {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.vc-dot { opacity: 0.5; }

@media (hover: none) {
  .vc-watch-later { opacity: 1; }
}
</style>
