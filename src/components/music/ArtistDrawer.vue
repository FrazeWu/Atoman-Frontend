<!-- web/src/components/music/ArtistDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  getMusicArtist,
  listMusicAlbums,
  type MusicAlbumListItem,
  type MusicArtistListItem,
} from '@/api/musicV1'

const { state, closeArtist, isArtistShifted, openAlbum, openNestedAction, openMusicCreationFlow } = useMusicDrawers()
const isOpen = computed(() => state.value.artistId !== null)
const artist = ref<MusicArtistListItem | null>(null)
const albums = ref<MusicAlbumListItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

function releaseYear(album: MusicAlbumListItem) {
  if (typeof album.year === 'number' && Number.isFinite(album.year) && album.year > 0) {
    return String(album.year)
  }
  return album.release_date ? album.release_date.slice(0, 4) : '----'
}

async function loadArtist(artistId: string | null) {
  if (!artistId) {
    artist.value = null
    albums.value = []
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const [artistResponse, albumsResponse] = await Promise.all([
      getMusicArtist(artistId),
      listMusicAlbums({ artist_id: artistId, page: 1, page_size: 100 }),
    ])
    artist.value = artistResponse
    albums.value = artistResponse.albums?.length ? artistResponse.albums : albumsResponse.data
  } catch (error) {
    console.error('Failed to fetch artist:', error)
    errorMessage.value = '艺术家信息加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => state.value.artistId, loadArtist, { immediate: true })
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeArtist"
    width="900px"
    :is-shifted="isArtistShifted"
    :index="0"
  >
    <template #header>
      <div class="drawer-header-content">
        <div class="kicker">ARTIST ENTRY</div>
        <h2 class="title">{{ artist?.name || `Artist ${state.artistId}` }}</h2>
        <p v-if="artist?.bio" class="artist-bio">{{ artist.bio }}</p>
      </div>
    </template>

    <div class="drawer-body">
      <div class="actions">
        <button class="paper-action" @click="openNestedAction('revise_artist')">
          <span class="paper-action-dot" aria-hidden="true" />
          <span>修订艺术家信息</span>
        </button>
        <button class="paper-action" @click="openMusicCreationFlow({ artistId: state.artistId || null, startStep: 'albumSeed' })">
          <span class="paper-action-dot" aria-hidden="true" />
          <span>添加新专辑</span>
        </button>
      </div>

      <div class="album-list-header">
        <p class="album-list-kicker">Discography</p>
        <h3>专辑列表</h3>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载专辑...</p>
      <p v-else-if="!albums.length" class="state-line">暂无专辑，可以提交新专辑 wiki 编辑。</p>

      <div
        v-for="album in albums"
        :key="album.id"
        class="album-row"
        @click="openAlbum(album.id)"
      >
        <div class="album-row-left">
          <div class="album-year">{{ releaseYear(album) }}</div>
        </div>
        <div class="album-row-right">
          <div class="album-row-cover">
            <img v-if="album.cover_url" :src="album.cover_url" alt="" class="album-row-img" />
            <span v-else>COVER</span>
          </div>
          <div class="album-row-info">
            <div class="album-row-title">{{ album.title }}</div>
            <div class="album-row-meta">{{ album.songs?.length || 0 }} Tracks · {{ album.album_type || 'Album' }}</div>
          </div>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.drawer-header-content { display: flex; flex-direction: column; gap: 0.25rem; }
.kicker {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}
.title { font-family: var(--a-font-serif); font-size: 2.5rem; margin: 0; line-height: 1.1; letter-spacing: -0.025em; }
.artist-bio { margin: 0.75rem 0 0; max-width: 44rem; color: var(--a-color-ink-soft); line-height: 1.6; }

.drawer-body { display: flex; flex-direction: column; }
.actions { display: flex; flex-wrap: wrap; gap: 0; margin-bottom: 2rem; border: 1px solid var(--a-color-line-soft); align-self: flex-start; }
.paper-action {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-right: 1px solid var(--a-color-line-soft);
  padding: 0.75rem 1.05rem;
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
.paper-action-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.6;
}

.album-list-header {
  margin-bottom: 1.5rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 12%, transparent);
}
.album-list-kicker {
  margin: 0 0 0.35rem;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
}
.album-list-header h3 { font-size: 1.15rem; font-weight: 900; margin: 0; letter-spacing: -0.02em; }
.album-row {
  display: flex;
  gap: 1.4rem;
  margin-bottom: 0;
  position: relative;
  cursor: pointer;
  padding: 1rem;
  border: none;
  border-bottom: 1px solid var(--a-color-line-soft);
  border-left: 3px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.album-row:first-of-type {
  border-top: 1px solid var(--a-color-line-soft);
}
.album-row:hover {
  background: var(--a-color-paper-soft);
  border-left-color: var(--a-color-ink);
}
.album-row-left { width: 80px; flex-shrink: 0; text-align: right; padding-top: 0.35rem; }
.album-year { font-family: var(--a-font-meta); font-size: 1.25rem; font-weight: 900; color: var(--a-color-ink); }
.album-row-right { flex: 1; display: flex; background: transparent; border: none; padding: 0; gap: 1rem; }
.album-row-cover {
  width: 80px;
  height: 80px;
  background: var(--a-color-paper-wash);
  border: 1px solid var(--a-color-line-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-meta);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--a-color-muted-soft);
  flex-shrink: 0;
  overflow: hidden;
}
.album-row-img { width: 100%; height: 100%; object-fit: cover; }
.album-row-info { display: flex; flex-direction: column; justify-content: center; gap: 0.25rem; }
.album-row-title { font-family: var(--a-font-serif); font-size: 1.35rem; font-weight: 900; letter-spacing: -0.015em; }
.album-row-meta { font-family: var(--a-font-meta); font-size: 0.75rem; color: var(--a-color-ink-soft); text-transform: uppercase; letter-spacing: 0.04em; }
.state-line { margin: 0 0 1.5rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: var(--a-color-accent-destructive); }
</style>
