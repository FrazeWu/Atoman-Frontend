<!-- web/src/components/music/ArtistDrawer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  getMusicArtist,
  listMusicAlbums,
  createArtistBookmark,
  deleteArtistBookmark,
  listArtistBookmarks,
  type MusicAlbumListItem,
  type MusicArtistListItem,
} from '@/api/musicV1'

const { state, closeArtist, isArtistShifted, openAlbum, openMusicEditor } = useMusicDrawers()
const isOpen = computed(() => state.value.artistId !== null)
const artist = ref<MusicArtistListItem | null>(null)
const albums = ref<MusicAlbumListItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const isBookmarked = ref(false)
const bookmarkLoading = ref(false)
const lastLoadKey = ref<string | null>(null)

const artistAliases = computed(() => (
  artist.value?.aliases
    ?.map((item) => item.alias.trim())
    .filter((alias) => alias && alias.toLowerCase() !== artist.value?.name.toLowerCase())
    ?? []
))

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
    isBookmarked.value = false
    lastLoadKey.value = null
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
    try {
      const bookmarksResponse = await listArtistBookmarks()
      isBookmarked.value = bookmarksResponse.data.some((bookmark) => String(bookmark.artist_id) === String(artistId))
    } catch (error) {
      if (error instanceof ApiErrorResponseError && error.status === 401) {
        isBookmarked.value = false
      } else {
        throw error
      }
    }
  } catch (error) {
    console.error('Failed to fetch artist:', error)
    errorMessage.value = '艺术家信息加载失败'
    lastLoadKey.value = null
  } finally {
    loading.value = false
  }
}

async function toggleArtistBookmark() {
  const artistId = state.value.artistId
  if (!artistId || bookmarkLoading.value) return
  bookmarkLoading.value = true
  try {
    if (isBookmarked.value) {
      await deleteArtistBookmark(artistId)
      isBookmarked.value = false
    } else {
      await createArtistBookmark(artistId)
      isBookmarked.value = true
    }
  } catch (error) {
    console.error('Failed to toggle artist bookmark:', error)
  } finally {
    bookmarkLoading.value = false
  }
}

watch(
  () => [state.value.artistId, state.value.artistRefreshToken] as const,
  ([artistId, refreshToken]) => {
    const nextKey = artistId ? `${artistId}:${refreshToken}` : null
    if (nextKey && nextKey === lastLoadKey.value) return
    lastLoadKey.value = nextKey
    void loadArtist(artistId)
  },
  { immediate: true },
)
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
        <div class="artist-header-profile">
          <img v-if="artist?.image_url" :src="artist.image_url" :alt="artist?.name" class="artist-header-avatar" />
          <div v-else class="artist-header-avatar-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.25">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div class="artist-header-info">
            <h2 class="title">{{ artist?.name || `Artist ${state.artistId}` }}</h2>
            <p v-if="artist?.legal_name" class="artist-meta-line">本名：{{ artist.legal_name }}</p>
            <p v-if="artistAliases.length" class="artist-meta-line">曾用名：{{ artistAliases.join(' / ') }}</p>
          </div>
        </div>
        <p v-if="artist?.bio" class="artist-bio">{{ artist.bio }}</p>
      </div>
    </template>

    <div class="drawer-body">
      <div class="actions">
        <PButton
          variant="secondary"
          :disabled="bookmarkLoading"
          dot
          data-testid="artist-bookmark-toggle"
          @click="toggleArtistBookmark"
        >
          {{ isBookmarked ? '已订阅' : '订阅' }}
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="state.artistId && openMusicEditor({ entity: 'artist', mode: 'edit', id: state.artistId })"
        >
          修改艺术家信息
        </PButton>
        <PButton
          variant="secondary"
          dot
          @click="openMusicEditor({
            entity: 'album',
            mode: 'create',
            seed: {
              artistId: state.artistId || null,
              artistName: artist?.name || '',
              artistLegalName: artist?.legal_name || '',
            },
          })"
        >
          添加新专辑
        </PButton>
      </div>

      <div class="album-list-header">
        <h3>专辑列表</h3>
      </div>

      <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
      <p v-else-if="loading" class="state-line">正在加载专辑...</p>
      <p v-else-if="!albums.length" class="state-line">暂无专辑，可以添加新专辑。</p>

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
            <div class="album-row-meta">{{ album.songs?.length || 0 }} 首 · 专辑</div>
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
.artist-meta-line {
  margin: 0.35rem 0 0;
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--a-color-ink-soft);
}
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

.artist-header-profile {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.artist-header-avatar {
  width: 90px;
  height: 90px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  flex-shrink: 0;
}

.artist-header-avatar-placeholder {
  width: 90px;
  height: 90px;
  border-radius: 8px;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.artist-header-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
