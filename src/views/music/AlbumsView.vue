<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  createAlbumBookmark,
  deleteAlbumBookmark,
  listAlbumBookmarks,
  listMusicAlbums,
  listRecommendedAlbums,
  type MusicAlbumListItem,
  type MusicBrowseMode,
  type MusicRecommendationItem,
} from '@/api/musicV1'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import { MusicAlbumCard } from '@/components/music'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { MUSIC_BROWSE_MODE_OPTIONS } from '@/utils/musicRecommendations'

const mode = ref<MusicBrowseMode>('hot')
const albums = ref<Array<MusicRecommendationItem | MusicAlbumListItem>>([])
const searchQuery = ref('')
const bookmarkedIds = ref<string[]>([])
const loading = ref(false)
const errorMessage = ref('')
const { isMainShifted, openAlbum } = useMusicDrawers()

async function fetchAlbums() {
  loading.value = true
  errorMessage.value = ''
  try {
    const query = searchQuery.value.trim()
    const [albumResponse, bookmarkResponse] = await Promise.all([
      query
        ? listMusicAlbums({ q: query, page: 1, page_size: 48, sort: mode.value === 'latest' ? '-created_at' : 'hot' })
        : listRecommendedAlbums(mode.value),
      listAlbumBookmarks().catch(() => ({ data: [] })),
    ])
    albums.value = albumResponse.data
    bookmarkedIds.value = bookmarkResponse.data.map((item) => String(item.album_id))
  } catch (error) {
    console.error('Failed to load music albums:', error)
    albums.value = []
    errorMessage.value = '专辑加载失败'
  } finally {
    loading.value = false
  }
}

async function toggleBookmark(albumId: string) {
  if (bookmarkedIds.value.includes(albumId)) {
    await deleteAlbumBookmark(albumId)
    bookmarkedIds.value = bookmarkedIds.value.filter((id) => id !== albumId)
    return
  }
  await createAlbumBookmark(albumId)
  bookmarkedIds.value = [...bookmarkedIds.value, albumId]
}

watch([mode, searchQuery], fetchAlbums)
onMounted(fetchAlbums)
</script>

<template>
  <div class="music-base-view">
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <PPageHeader title="专辑" mb="0" />

      <div class="toolbar-row">
        <div class="toolbar-left">
          <div class="search-shell">
            <SearchSurface
              v-model:query="searchQuery"
              :open="false"
              compact
              eyebrow=""
              placeholder="搜索专辑..."
            />
          </div>
        </div>
        <div class="toolbar-right">
          <PSegmentedControl v-model="mode" :options="MUSIC_BROWSE_MODE_OPTIONS" aria-label="专辑排序" />
        </div>
      </div>

      <PEmpty v-if="errorMessage" :text="errorMessage" role="alert">
        <template #action>
          <PButton data-testid="retry-albums" size="sm" @click="fetchAlbums">重新加载</PButton>
        </template>
      </PEmpty>
      <div v-else-if="loading" class="music-card-grid music-card-grid--skeleton" role="status" aria-label="正在加载专辑">
        <div v-for="index in 6" :key="index" class="a-skeleton music-card-skeleton" />
      </div>
      <PEmpty v-else-if="!albums.length" text="暂无专辑" />

      <div v-else class="music-card-grid" aria-label="专辑列表">
        <MusicAlbumCard
          v-for="album in albums"
          :key="album.id"
          :album="album"
          :is-bookmarked="bookmarkedIds.includes(String(album.id))"
          data-testid="album-card"
          @click="openAlbum(String(album.id))"
          @toggle-bookmark="toggleBookmark(String(album.id))"
        />
      </div>
    </div>
    <AlbumDrawer />
  </div>
</template>

<style scoped>
.music-base-view { position: relative; }
.main-level-1 { display: flex; flex-direction: column; gap: 1.5rem; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s; }
.main-level-1.is-shifted { pointer-events: none; }
.toolbar-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.toolbar-left { min-width: 0; flex: 1 1 auto; }
.toolbar-right { display: flex; align-items: center; flex: 0 0 auto; }
.search-shell { width: min(28rem, 100%); min-height: 36px; }
.music-card-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1.25rem; }
.music-card-skeleton { aspect-ratio: 1; }
@media (max-width: 1100px) { .music-card-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 720px) {
  .toolbar-row { flex-direction: column; align-items: stretch; }
  .toolbar-right { align-items: stretch; }
  .search-shell { width: 100%; }
  .music-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem 0.75rem; }
}
@media (prefers-reduced-motion: reduce) { .main-level-1 { transition: none; } }
</style>
