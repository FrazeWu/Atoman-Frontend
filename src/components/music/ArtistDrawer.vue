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

const { state, closeArtist, isArtistShifted, openAlbum, openNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.artistId !== null)
const artist = ref<MusicArtistListItem | null>(null)
const albums = ref<MusicAlbumListItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

function releaseYear(album: MusicAlbumListItem) {
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
        <button class="a-btn-dashed" @click="openNestedAction('revise_artist')">✍ 修订艺术家信息</button>
        <button class="a-btn-dashed" @click="openNestedAction('add_album')">+ 添加新专辑</button>
      </div>

      <div class="album-list-header">
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
.kicker { font-family: var(--a-font-meta); font-size: 0.75rem; font-weight: bold; letter-spacing: 0.1em; color: var(--a-color-ink-soft); }
.title { font-family: var(--a-font-serif); font-size: 2.5rem; margin: 0; line-height: 1.1; }
.artist-bio { margin: 0.75rem 0 0; max-width: 44rem; color: var(--a-color-ink-soft); line-height: 1.6; }

.drawer-body { display: flex; flex-direction: column; }
.actions { display: flex; gap: 1rem; margin-bottom: 2rem; }
.a-btn-dashed { border: 1.5px dashed var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: transparent; cursor: pointer; font-family: var(--a-font-meta); }
.a-btn-dashed:hover { background: var(--a-color-paper-soft); }

.album-list-header { margin-bottom: 2rem; border-bottom: 1px dashed var(--a-color-line-soft); padding-bottom: 1rem; }
.album-list-header h3 { font-size: 1.2rem; font-weight: 900; margin: 0; }
.album-row { display: flex; gap: 2rem; margin-bottom: 2rem; position: relative; cursor: pointer; transition: transform 0.1s; }
.album-row:hover { transform: translateX(4px); }
.album-row-left { width: 100px; flex-shrink: 0; text-align: right; padding-top: 0.5rem; }
.album-year { font-family: var(--a-font-meta); font-size: 1.5rem; font-weight: 900; color: var(--a-color-ink); }
.album-row-right { flex: 1; display: flex; background: var(--a-color-paper); border: 2px solid var(--a-color-ink); padding: 1rem; gap: 1.5rem; }
.album-row-right:hover { box-shadow: 4px 4px 0 0 rgba(0,0,0,0.1); }
.album-row-cover { width: 100px; height: 100px; background: var(--a-color-paper-wash); border: 1px solid var(--a-color-ink); display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); font-size: 0.7rem; color: var(--a-color-ink-soft); flex-shrink: 0; }
.album-row-img { width: 100%; height: 100%; object-fit: cover; }
.album-row-info { display: flex; flex-direction: column; justify-content: center; }
.album-row-title { font-family: var(--a-font-serif); font-size: 1.5rem; font-weight: 900; margin-bottom: 0.25rem; }
.album-row-meta { font-family: var(--a-font-meta); font-size: 0.8rem; color: var(--a-color-ink-soft); }
.state-line { margin: 0 0 1.5rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-weight: 800; }
.state-line--error { color: #b42318; }
</style>
