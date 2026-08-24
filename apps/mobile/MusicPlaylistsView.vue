<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import {
  listMusicPlaylists,
  listPlaylistBookmarks,
  deletePlaylistBookmark,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { MusicPlaylistCard } from '@/components/music'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { openPlaylist } = useMusicDrawers()
const ownedPlaylists = ref<MusicPlaylistSummary[]>([])
const bookmarkedPlaylists = ref<MusicPlaylistSummary[]>([])
const loading = ref(false)
const error = ref('')
const removingId = ref('')

const isAuthenticated = computed(() => authStore.isAuthenticated && Boolean(authStore.user))

function toCardItem(playlist: MusicPlaylistSummary) {
  return { ...playlist, title: playlist.name }
}

async function loadPlaylists() {
  if (!isAuthenticated.value) return
  loading.value = true
  error.value = ''
  try {
    const [ownedResponse, bookmarkedResponse] = await Promise.all([
      listMusicPlaylists({ page: 1, page_size: 100 }),
      listPlaylistBookmarks({ page: 1, page_size: 100 }),
    ])
    ownedPlaylists.value = ownedResponse.data.filter(playlist => playlist.kind !== 'favorite' && playlist.kind !== 'later')
    bookmarkedPlaylists.value = bookmarkedResponse.data
      .map(bookmark => bookmark.playlist)
      .filter((playlist): playlist is MusicPlaylistSummary => Boolean(playlist))
      .filter((playlist, index, playlists) => playlists.findIndex(item => item.id === playlist.id) === index)
  } catch {
    error.value = '歌单加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function removeBookmark(playlistId: string) {
  if (removingId.value) return
  removingId.value = playlistId
  error.value = ''
  try {
    await deletePlaylistBookmark(playlistId)
    bookmarkedPlaylists.value = bookmarkedPlaylists.value.filter(playlist => playlist.id !== playlistId)
  } catch {
    error.value = '取消收藏失败，请重试'
  } finally {
    removingId.value = ''
  }
}

watch(isAuthenticated, (authenticated) => {
  if (authenticated) void loadPlaylists()
}, { immediate: true })
</script>

<template>
  <main class="a-page-md music-playlists-view">
    <PPageHeader title="歌单" mb="1.25rem">
      <template #action>
        <button
          type="button"
          class="music-playlists__refresh"
          aria-label="刷新歌单"
          title="刷新歌单"
          :disabled="loading"
          @click="loadPlaylists"
        >
          <RefreshCw :size="18" :class="{ 'is-spinning': loading }" aria-hidden="true" />
        </button>
      </template>
    </PPageHeader>

    <PEmpty
      v-if="!isAuthenticated"
      title="登录后查看歌单"
      description="登录后可以查看自己创建和收藏的歌单。"
    >
      <template #action>
        <RouterLink to="/login" class="a-btn a-btn--primary">登录</RouterLink>
      </template>
    </PEmpty>

    <p v-else-if="loading" class="music-playlists__state">正在加载歌单...</p>
    <p v-else-if="error" class="music-playlists__state music-playlists__state--error" role="alert">{{ error }}</p>

    <template v-else>
      <section class="music-playlists__section" aria-labelledby="owned-playlists-title">
        <header class="music-playlists__section-header">
          <h2 id="owned-playlists-title">我创建的</h2>
          <span>{{ ownedPlaylists.length }}</span>
        </header>
        <div v-if="ownedPlaylists.length" class="music-playlists__grid">
          <MusicPlaylistCard
            v-for="playlist in ownedPlaylists"
            :key="playlist.id"
            :playlist="toCardItem(playlist)"
            :show-bookmark-button="false"
            data-testid="owned-playlist-card"
            @click="openPlaylist(String(playlist.id))"
          />
        </div>
        <p v-else class="music-playlists__empty">还没有创建歌单</p>
      </section>

      <section class="music-playlists__section" aria-labelledby="bookmarked-playlists-title">
        <header class="music-playlists__section-header">
          <h2 id="bookmarked-playlists-title">我收藏的</h2>
          <span>{{ bookmarkedPlaylists.length }}</span>
        </header>
        <div v-if="bookmarkedPlaylists.length" class="music-playlists__grid">
          <MusicPlaylistCard
            v-for="playlist in bookmarkedPlaylists"
            :key="playlist.id"
            :playlist="toCardItem(playlist)"
            :is-bookmarked="true"
            :show-bookmark-button="true"
            data-testid="bookmarked-playlist-card"
            @click="openPlaylist(String(playlist.id))"
            @toggle-bookmark="removeBookmark(String(playlist.id))"
          />
        </div>
        <p v-else class="music-playlists__empty">还没有收藏歌单</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.music-playlists-view {
  min-height: 100%;
  padding-bottom: 3rem;
}

.music-playlists__refresh {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
}

.music-playlists__refresh:hover,
.music-playlists__refresh:focus-visible {
  background: var(--a-color-surface-muted);
}

.music-playlists__refresh:disabled {
  color: var(--a-color-muted);
  cursor: default;
}

.music-playlists__refresh .is-spinning {
  animation: music-playlists-spin 0.9s linear infinite;
}

.music-playlists__section + .music-playlists__section {
  margin-top: 2rem;
}

.music-playlists__section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.music-playlists__section-header h2 {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 1.05rem;
  font-weight: 650;
}

.music-playlists__section-header span {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.music-playlists__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem 1rem;
}

.music-playlists__empty,
.music-playlists__state {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.music-playlists__state--error {
  color: var(--a-color-danger, #ff3b30);
}

@keyframes music-playlists-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .music-playlists__refresh .is-spinning { animation: none; }
}
</style>
