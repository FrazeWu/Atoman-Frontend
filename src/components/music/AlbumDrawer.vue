<!-- web/src/components/music/AlbumDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import PDiscussionFAB from '@/components/ui/PDiscussionFAB.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { getMusicAlbum, type MusicAlbumListItem } from '@/api/musicV1'

const { state, closeAlbum, isAlbumShifted, openNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.albumId !== null)
const sheetIndex = computed(() => state.value.artistId !== null ? 1 : 0)
const album = ref<MusicAlbumListItem | null>(null)
const loading = ref(false)
const errorMessage = ref('')

const artistNames = computed(() => album.value?.artists?.map((artist) => artist.name).join(' / ') || 'Unknown Artist')
const releaseYear = computed(() => album.value?.release_date?.slice(0, 4) || '----')
const tracks = computed(() => [...(album.value?.songs || [])].sort((a, b) => (a.track_number || 0) - (b.track_number || 0)))

async function loadAlbum(albumId: string | null) {
  if (!albumId) {
    album.value = null
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    album.value = await getMusicAlbum(albumId)
  } catch (error) {
    console.error('Failed to fetch album:', error)
    errorMessage.value = '专辑信息加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => state.value.albumId, loadAlbum, { immediate: true })
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeAlbum"
    width="700px"
    :is-shifted="isAlbumShifted"
    :index="sheetIndex"
  >
    <div class="drawer-header">
      <div>
        <div class="kicker">Album Notes</div>
        <h2 class="title">{{ album?.title || `Album ${state.albumId}` }}</h2>
      </div>
    </div>

    <div class="drawer-body">
      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载专辑...</p>

      <div class="album-meta-row">
        <div class="album-cover">
          <img v-if="album?.cover_url" :src="album.cover_url" alt="" class="album-cover-img" />
          <span v-else>COVER</span>
        </div>
        <div class="album-info">
          <div class="meta-tags">
            <span>{{ artistNames }}</span>
            <span>{{ releaseYear }}</span>
            <span>{{ album?.album_type || 'Album' }}</span>
          </div>
          <p class="summary">{{ album?.description || '暂无专辑简介。' }}</p>
        </div>
      </div>

      <div class="action-bar">
        <button class="paper-action paper-action--primary">
          <span class="paper-action-dot" aria-hidden="true" />
          播放全专
        </button>
        <button class="paper-action">
          <span class="paper-action-dot" aria-hidden="true" />
          收藏
        </button>
        <div class="spacer"></div>
        <button class="paper-action" @click="openNestedAction('revise')">
          <span class="paper-action-dot" aria-hidden="true" />
          修订
        </button>
        <button class="paper-action" @click="openNestedAction('history')">
          <span class="paper-action-dot" aria-hidden="true" />
          历史
        </button>
      </div>

      <div class="content-section">
        <div class="section-title">Tracklist</div>
        <div v-if="!tracks.length" class="track-empty">暂无曲目。</div>
        <div v-for="(track, index) in tracks" :key="track.id" class="track">
          <div><span class="track-num">{{ String(track.track_number || index + 1).padStart(2, '0') }}</span> {{ track.title }}</div>
          <div class="track-time">03:45</div>
        </div>
      </div>
    </div>
    <PDiscussionFAB v-if="isOpen" @click="openNestedAction('discussion')" count="12" />
  </PSheet>
</template>

<style scoped>
.drawer-header {
  margin: -2.5rem -2.5rem 0;
  padding: 2rem 2.5rem 1.5rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: var(--a-color-paper-soft);
}
.kicker {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
  margin-bottom: 0.5rem;
}
.title { font-family: var(--a-font-serif); font-size: 2rem; margin: 0; letter-spacing: -0.02em; }
.drawer-body { margin: 0 -2.5rem; padding: 2rem 2.5rem; }

.album-meta-row { display: flex; gap: 2rem; margin-bottom: 2rem; }
.album-cover {
  width: 160px;
  height: 160px;
  background: var(--a-color-paper-wash);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-meta);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--a-color-muted-soft);
  overflow: hidden;
  border: 1px solid var(--a-color-line-soft);
}
.album-cover-img { width: 100%; height: 100%; object-fit: cover; }
.album-info { flex: 1; }
.meta-tags {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--a-color-muted);
}
.meta-tags span {
  padding-right: 0.75rem;
  margin-right: 0.75rem;
  border-right: 1px solid var(--a-color-line-soft);
}
.meta-tags span:last-child {
  border-right: none;
  margin-right: 0;
  padding-right: 0;
}
.summary { color: var(--a-color-ink-soft); font-size: 0.875rem; line-height: 1.65; margin: 0; }

.action-bar {
  display: flex;
  gap: 0;
  margin-bottom: 2rem;
  border: 1px solid var(--a-color-line-soft);
}
.spacer { flex: 1; }
.paper-action {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-right: 1px solid var(--a-color-line-soft);
  padding: 0.75rem 1rem;
  font-weight: 800;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.paper-action:last-child {
  border-right: none;
}
.paper-action:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}
.paper-action--primary {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}
.paper-action--primary:hover {
  background: var(--a-color-ink-muted);
}
.paper-action-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.6;
}

.content-section {
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
}
.section-title {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid var(--a-color-line-soft);
  padding-bottom: 0.5rem;
  margin-bottom: 1.25rem;
  color: var(--a-color-ink-soft);
  font-weight: 800;
}
.track {
  display: flex;
  justify-content: space-between;
  padding: 0.65rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 8%, transparent);
  font-size: 0.9rem;
}
.track:last-child { border-bottom: none; }
.track-empty { color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.875rem; }
.track-num { color: var(--a-color-muted-soft); margin-right: 1rem; font-family: var(--a-font-meta); font-size: 0.8rem; }
.track-time { font-family: var(--a-font-meta); color: var(--a-color-ink-soft); font-size: 0.8rem; }
.state-line { margin: 0 0 1.5rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: var(--a-color-accent-destructive); }
</style>
