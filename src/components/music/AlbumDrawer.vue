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
        <button class="paper-action paper-action--primary">▶ 播放全专</button>
        <button class="paper-action">★ 收藏</button>
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
.drawer-header { padding: 2rem 3rem; border-bottom: none; display: flex; justify-content: space-between; align-items: flex-start; background: linear-gradient(180deg, color-mix(in srgb, var(--a-color-paper-wash) 82%, white), transparent); }
.kicker { font-family: var(--a-font-meta); font-size: 0.75rem; font-weight: bold; letter-spacing: 0.1em; color: var(--a-color-ink-soft); margin-bottom: 0.5rem; }
.title { font-family: var(--a-font-serif); font-size: 2rem; margin: 0; }
.drawer-body { padding: 2rem 3rem; }

.album-meta-row { display: flex; gap: 2rem; margin-bottom: 2rem; }
.album-cover { width: 160px; height: 160px; background: #eee; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); color: #999; overflow: hidden; }
.album-cover-img { width: 100%; height: 100%; object-fit: cover; }
.album-info { flex: 1; }
.meta-tags { display: flex; gap: 1rem; margin-bottom: 1rem; font-family: var(--a-font-meta); font-size: 0.8rem; }
.summary { color: var(--a-color-ink-soft); font-size: 0.9rem; }

.action-bar { display: flex; gap: 0.75rem; margin-bottom: 2rem; padding: 1rem 1.1rem; background: color-mix(in srgb, var(--a-color-paper-wash) 74%, white); border-radius: 8px; }
.spacer { flex: 1; }
.paper-action {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-radius: 0px;
  padding: 0.8rem 1rem;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font-family: var(--a-font-meta);
}
.paper-action--primary {
  background: color-mix(in srgb, var(--a-color-ink) 92%, #6b4f3a 8%);
  color: white;
}
.paper-action-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
}

.content-section { background: color-mix(in srgb, var(--a-color-paper-wash) 74%, white); border-radius: 8px; padding: 2rem; margin-bottom: 2rem; }
.section-title { font-family: var(--a-font-meta); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--a-color-line-soft); padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: var(--a-color-ink-soft); }
.track { display: flex; justify-content: space-between; padding: 0.7rem 0; border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent); }
.track-empty { color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.875rem; }
.track-num { color: #999; margin-right: 1rem; font-family: var(--a-font-meta); }
.track-time { font-family: var(--a-font-meta); color: var(--a-color-ink-soft); }
.state-line { margin: 0 0 1.5rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: #b42318; }
</style>
