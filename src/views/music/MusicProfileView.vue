<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BarChart3, Clock3, RefreshCw, Settings, Star } from 'lucide-vue-next'
import {
  deleteAlbumBookmark,
  deleteArtistBookmark,
  getMusicHome,
  listAlbumBookmarks,
  listArtistBookmarks,
  listMusicListeningHistory,
} from '@/api/musicV1'
import type { MusicAlbumBookmark, MusicArtistBookmark } from '@/api/musicV1/types'
import { MusicAlbumCard, MusicArtistCard } from '@/components/music'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useRequestGeneration } from '@/composables/useRequestGeneration'
import { useAuthStore } from '@/stores/auth'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const authStore = useAuthStore()
const { openAlbum, openArtist } = useMusicDrawers()
const loading = ref(false)
const error = ref('')
const listenedCount = ref(0)
const favoriteCount = ref(0)
const recentCount = ref(0)
const albumBookmarks = ref<MusicAlbumBookmark[]>([])
const artistBookmarks = ref<MusicArtistBookmark[]>([])
const overviewRequests = useRequestGeneration()

const isAuthenticated = computed(() => authStore.isAuthenticated && Boolean(authStore.user))

async function loadOverview() {
  if (!isAuthenticated.value) return
  const request = overviewRequests.beginRequest()
  loading.value = true
  error.value = ''
  try {
    const [history, albums, artists, home] = await Promise.all([
      listMusicListeningHistory({ page: 1, page_size: 1 }),
      listAlbumBookmarks({ page: 1, page_size: 100 }),
      listArtistBookmarks({ page: 1, page_size: 100 }),
      getMusicHome(),
    ])
    if (!request.isCurrent()) return
    albumBookmarks.value = albums.data
    artistBookmarks.value = artists.data
    listenedCount.value = history.meta.total
    favoriteCount.value = (albums.meta?.total ?? albums.data.length) + (artists.meta?.total ?? artists.data.length)
    recentCount.value = home.recently_played.length
  } catch {
    if (request.isCurrent()) error.value = '统计加载失败，请重试'
  } finally {
    if (request.isCurrent()) loading.value = false
  }
}

async function removeAlbumBookmark(albumId: string) {
  try {
    await deleteAlbumBookmark(albumId)
    albumBookmarks.value = albumBookmarks.value.filter(bookmark => bookmark.album_id !== albumId)
    favoriteCount.value = Math.max(0, favoriteCount.value - 1)
  } catch {
    error.value = '取消专辑收藏失败，请重试'
  }
}

async function removeArtistBookmark(artistId: string) {
  try {
    await deleteArtistBookmark(artistId)
    artistBookmarks.value = artistBookmarks.value.filter(bookmark => bookmark.artist_id !== artistId)
    favoriteCount.value = Math.max(0, favoriteCount.value - 1)
  } catch {
    error.value = '取消艺人收藏失败，请重试'
  }
}

watch(
  () => [isAuthenticated.value, authStore.user?.id ?? authStore.user?.username ?? ''] as const,
  ([authenticated]) => {
    overviewRequests.beginRequest()
    if (authenticated) void loadOverview()
  },
  { immediate: true },
)
</script>

<template>
  <div class="a-page-md music-profile-view">
    <PPageHeader title="我的" mb="1.25rem">
      <template #action>
        <button
          v-if="isAuthenticated"
          type="button"
          class="music-profile__refresh"
          aria-label="刷新音乐个人页"
          data-testid="music-profile-refresh"
          title="刷新音乐个人页"
          :disabled="loading"
          @click="loadOverview"
        >
          <RefreshCw :size="18" :class="{ 'is-spinning': loading }" aria-hidden="true" />
        </button>
      </template>
    </PPageHeader>

    <PEmpty
      v-if="!isAuthenticated"
      title="登录后查看音乐统计"
      description="登录账号以同步收藏、播放历史和跨端收听记录。"
    >
      <template #action>
        <RouterLink to="/login" class="a-btn a-btn--primary">登录</RouterLink>
      </template>
    </PEmpty>

    <template v-else>
      <p v-if="error" class="music-profile__error" role="alert">{{ error }}</p>
      <div v-if="loading" class="music-profile__state">加载中...</div>
      <template v-else>
        <div class="music-profile__stats" aria-label="音乐统计">
          <article class="music-profile__stat">
            <BarChart3 :size="18" aria-hidden="true" />
            <strong>{{ listenedCount }}</strong>
            <span>听过的歌曲</span>
          </article>
          <article class="music-profile__stat">
            <Star :size="18" aria-hidden="true" />
            <strong>{{ favoriteCount }}</strong>
            <span>专辑与艺人收藏</span>
          </article>
          <article class="music-profile__stat">
            <Clock3 :size="18" aria-hidden="true" />
            <strong>{{ recentCount }}</strong>
            <span>最近播放</span>
          </article>
        </div>

        <section class="music-profile__favorites" aria-labelledby="music-profile-favorites-title">
          <header class="music-profile__section-header">
            <h2 id="music-profile-favorites-title">其他收藏</h2>
            <span>{{ favoriteCount }}</span>
          </header>
          <div v-if="albumBookmarks.length || artistBookmarks.length" class="music-profile__favorite-grid">
            <template v-for="bookmark in albumBookmarks" :key="`album-${bookmark.id}`">
              <MusicAlbumCard
                v-if="bookmark.album"
                :album="bookmark.album"
                :is-bookmarked="true"
                :show-bookmark="true"
                @click="openAlbum(String(bookmark.album.id))"
                @click-artist="openArtist"
                @toggle-bookmark="removeAlbumBookmark(String(bookmark.album_id))"
              />
            </template>
            <template v-for="bookmark in artistBookmarks" :key="`artist-${bookmark.id}`">
              <MusicArtistCard
                v-if="bookmark.artist"
                :artist="bookmark.artist"
                :is-bookmarked="true"
                :show-bookmark-button="true"
                @click="openArtist(String(bookmark.artist.id))"
                @toggle-bookmark="removeArtistBookmark(String(bookmark.artist_id))"
              />
            </template>
          </div>
          <p v-else class="music-profile__empty">还没有收藏专辑或艺人</p>
        </section>
      </template>

      <nav class="music-profile__links" aria-label="音乐个人入口">
        <RouterLink to="/music/history"><Clock3 :size="18" aria-hidden="true" /><span>播放历史</span></RouterLink>
        <RouterLink to="/music/playlists"><Star :size="18" aria-hidden="true" /><span>歌单</span></RouterLink>
        <RouterLink :to="authStore.user ? `/users/${authStore.user.username}/settings` : '/login'"><Settings :size="18" aria-hidden="true" /><span>音乐设置</span></RouterLink>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.music-profile-view {
  min-height: 100%;
  padding-bottom: 3rem;
}

.music-profile__refresh {
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

.music-profile__refresh:hover,
.music-profile__refresh:focus-visible {
  background: var(--a-color-surface-muted);
}

.music-profile__refresh:disabled {
  color: var(--a-color-muted);
  cursor: default;
}

.music-profile__refresh .is-spinning {
  animation: music-profile-spin 0.9s linear infinite;
}

@keyframes music-profile-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .music-profile__refresh .is-spinning { animation: none; }
}

.music-profile__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.music-profile__stat {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.music-profile__stat strong {
  font-size: 1.35rem;
  font-weight: 500;
}

.music-profile__stat span,
.music-profile__state,
.music-profile__error,
.music-profile__empty {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.music-profile__error {
  margin-bottom: 1rem;
  color: var(--a-color-danger);
}

.music-profile__favorites {
  margin-bottom: 1.5rem;
}

.music-profile__section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.music-profile__section-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
}

.music-profile__section-header span {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.music-profile__favorite-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem 1rem;
}

.music-profile__empty {
  margin: 0;
}

.music-profile__links {
  display: grid;
  gap: 0.5rem;
}

.music-profile__links a {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-fg);
  text-decoration: none;
}

.music-profile__links a:hover,
.music-profile__links a:focus-visible {
  border-color: var(--a-color-fg);
}

@media (max-width: 520px) {
  .music-profile__stats {
    grid-template-columns: 1fr;
  }
}
</style>
