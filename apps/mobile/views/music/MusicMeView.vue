<template>
  <div class="mobile-music-me">
    <!-- Unauthenticated Guest Card -->
    <div v-if="!isAuthenticated" class="mobile-music-me__guest-wrap">
      <MGuestCard
        title="登录以同步你的音乐"
        description="登录后可跨端畅享收藏专辑、自建歌单与完整收听历史。"
        icon="music"
        login-redirect="/music/me"
      />
    </div>

    <!-- Authenticated User Content -->
    <template v-else>
      <!-- User Profile Header -->
      <header class="mobile-music-me__header">
        <div class="mobile-music-me__user-card">
          <MAvatar
            :src="authStore.user?.avatar_url"
            :name="authStore.user?.display_name || authStore.user?.username || '用户'"
            :size="54"
            class="mobile-music-me__avatar"
          />
          <div class="mobile-music-me__user-info">
            <h1 class="mobile-music-me__name">
              {{ authStore.user?.display_name || authStore.user?.username }}
            </h1>
            <span class="mobile-music-me__handle">
              @{{ authStore.user?.username }}
            </span>
          </div>
        </div>

        <!-- Music Module Stats -->
        <div class="mobile-music-me__stats">
          <div class="mobile-music-me__stat" @click="activeTab = 'starred'">
            <span class="mobile-music-me__stat-val">{{ starredList.length }}</span>
            <span class="mobile-music-me__stat-label">我的收藏</span>
          </div>
          <div class="mobile-music-me__stat-divider" />
          <div class="mobile-music-me__stat" @click="activeTab = 'history'">
            <span class="mobile-music-me__stat-val">{{ historyList.length }}</span>
            <span class="mobile-music-me__stat-label">收听历史</span>
          </div>
          <div class="mobile-music-me__stat-divider" />
          <div class="mobile-music-me__stat" @click="activeTab = 'playlists'">
            <span class="mobile-music-me__stat-val">{{ userPlaylists.length }}</span>
            <span class="mobile-music-me__stat-label">自建歌单</span>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="mobile-music-me__tabs" aria-label="音乐个人中心切换">
          <button
            type="button"
            class="mobile-music-me__tab"
            :class="{ 'is-active': activeTab === 'starred' }"
            data-testid="tab-starred"
            @click="activeTab = 'starred'"
          >
            收藏
          </button>
          <button
            type="button"
            class="mobile-music-me__tab"
            :class="{ 'is-active': activeTab === 'history' }"
            data-testid="tab-history"
            @click="activeTab = 'history'"
          >
            收听历史
          </button>
          <button
            type="button"
            class="mobile-music-me__tab"
            :class="{ 'is-active': activeTab === 'playlists' }"
            data-testid="tab-playlists"
            @click="activeTab = 'playlists'"
          >
            我的歌单
          </button>
        </nav>
      </header>

      <main class="mobile-music-me__content">
        <!-- Loading State -->
        <div v-if="loading" class="mobile-music-me__loading">
          <div v-for="n in 4" :key="n" class="mobile-music-me__skeleton" />
        </div>

        <!-- TAB 1: 收藏 (Starred Albums & Playlists & Artists) -->
        <section v-else-if="activeTab === 'starred'" class="mobile-music-me__section">
          <div v-if="starredList.length > 0" class="mobile-music-me__list">
            <div
              v-for="item in starredList"
              :key="item.id"
              class="mobile-music-me__item"
              data-testid="starred-item"
              @click="openStarred(item)"
            >
              <div class="mobile-music-me__item-cover">
                <img v-if="item.cover_url" :src="item.cover_url" :alt="item.title" />
                <div v-else class="mobile-music-me__item-art">
                  <MIcon :name="item.kind === 'album' ? 'note' : item.kind === 'artist' ? 'person' : 'playlists'" size="sm" />
                </div>
              </div>

              <div class="mobile-music-me__item-meta">
                <span class="mobile-music-me__item-title">{{ item.title }}</span>
                <span class="mobile-music-me__item-sub">
                  {{ item.kind === 'album' ? '专辑' : item.kind === 'artist' ? '艺人' : '歌单' }} · {{ item.subtitle || '收藏项' }}
                </span>
              </div>

              <MIcon name="chevron-right" size="xs" class="mobile-music-me__arrow" />
            </div>
          </div>

          <div v-else class="mobile-music-me__empty" data-testid="empty-starred">
            <MIcon name="heart" size="lg" class="mobile-music-me__empty-icon" />
            <p class="mobile-music-me__empty-title">暂无收藏内容</p>
            <p class="mobile-music-me__empty-desc">在发现音乐或搜索中，收藏你喜爱的专辑与歌单。</p>
            <router-link to="/music">
              <MButton size="sm" variant="secondary">去发现音乐</MButton>
            </router-link>
          </div>
        </section>

        <!-- TAB 2: 收听历史 (Listening History) -->
        <section v-else-if="activeTab === 'history'" class="mobile-music-me__section">
          <div v-if="historyList.length > 0" class="mobile-music-me__list">
            <button
              v-for="(track, index) in historyList"
              :key="track.id || index"
              type="button"
              class="mobile-music-me__item"
              data-testid="history-item"
              :disabled="!canPlayMusicSong(track)"
              :aria-label="canPlayMusicSong(track) ? '播放' + track.title : track.title + '，暂无可播放音源'"
              @click="playSong(track)"
            >
              <span class="mobile-music-me__track-index">{{ String(index + 1).padStart(2, '0') }}</span>

              <div class="mobile-music-me__item-cover">
                <img v-if="track.cover_url" :src="track.cover_url" :alt="track.title" />
                <div v-else class="mobile-music-me__item-art">
                  <MIcon name="note" size="sm" />
                </div>
              </div>

              <div class="mobile-music-me__item-meta">
                <span class="mobile-music-me__item-title">{{ track.title }}</span>
                <span class="mobile-music-me__item-sub">
                  {{ track.artist }} · {{ track.album || '未归类' }}
                </span>
              </div>

              <span v-if="!canPlayMusicSong(track)" class="mobile-music-no-audio">暂无音源</span>
              <span v-else-if="formatDuration(track.duration)" class="mobile-music-me__item-dur">
                {{ formatDuration(track.duration) }}
              </span>
            </button>
          </div>

          <div v-else class="mobile-music-me__empty" data-testid="empty-history">
            <MIcon name="waveform" size="lg" class="mobile-music-me__empty-icon" />
            <p class="mobile-music-me__empty-title">暂无收听历史</p>
            <p class="mobile-music-me__empty-desc">随时点播歌曲，记录你的音乐足迹。</p>
            <router-link to="/music">
              <MButton size="sm" variant="secondary">开启音乐之旅</MButton>
            </router-link>
          </div>
        </section>

        <!-- TAB 3: 我的歌单 (My Playlists) -->
        <section v-else-if="activeTab === 'playlists'" class="mobile-music-me__section">
          <!-- Create Playlist Bar / Action -->
          <div class="mobile-music-me__playlists-bar">
            <span class="mobile-music-me__playlists-count">自建歌单 ({{ userPlaylists.length }})</span>
            <MButton
              v-if="!showCreatePlaylist"
              size="sm"
              variant="secondary"
              data-testid="create-playlist-trigger-btn"
              @click="showCreatePlaylist = true"
            >
              <MIcon name="plus" size="xs" />
              <span>新建歌单</span>
            </MButton>
          </div>

          <!-- Create Form / Sheet -->
          <div v-if="showCreatePlaylist" class="mobile-music-me__create-box">
            <MInput
              v-model="newPlaylistName"
              placeholder="输入新歌单名称..."
              clearable
            />
            <div class="mobile-music-me__create-actions">
              <MButton size="sm" variant="ghost" @click="showCreatePlaylist = false">取消</MButton>
              <MButton
                size="sm"
                variant="primary"
                data-testid="create-playlist-confirm-btn"
                :disabled="!newPlaylistName.trim()"
                @click="handleCreatePlaylist"
              >
                确定创建
              </MButton>
            </div>
          </div>

          <div v-if="userPlaylists.length > 0" class="mobile-music-me__list">
            <div
              v-for="pl in userPlaylists"
              :key="pl.id"
              class="mobile-music-me__item"
              data-testid="playlist-item"
              @click="openPlaylist(pl.id)"
            >
              <div class="mobile-music-me__item-cover">
                <img v-if="pl.cover_url" :src="pl.cover_url" :alt="pl.name" />
                <div v-else class="mobile-music-me__item-art">
                  <MIcon name="playlists" size="md" />
                </div>
              </div>

              <div class="mobile-music-me__item-meta">
                <span class="mobile-music-me__item-title">{{ pl.name }}</span>
                <span class="mobile-music-me__item-sub">{{ pl.song_count || 0 }} 首曲目</span>
              </div>

              <MIcon name="chevron-right" size="xs" class="mobile-music-me__arrow" />
            </div>
          </div>

          <div v-else-if="!showCreatePlaylist" class="mobile-music-me__empty" data-testid="empty-playlists">
            <MIcon name="playlists" size="lg" class="mobile-music-me__empty-icon" />
            <p class="mobile-music-me__empty-title">暂无自建歌单</p>
            <p class="mobile-music-me__empty-desc">创建专属歌单，整理属于你的曲库合集。</p>
            <MButton
              size="sm"
              variant="secondary"
              data-testid="create-playlist-trigger-btn"
              @click="showCreatePlaylist = true"
            >
              新建歌单
            </MButton>
          </div>
        </section>
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  createMusicPlaylist,
  listAlbumBookmarks,
  listArtistBookmarks,
  listPlaylistBookmarks,
  listMusicListeningHistory,
  listMusicPlaylists,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import { useAuthStore } from '@/stores/auth'
import { useAudioPlayerStore } from '@/stores/player'
import type { Song } from '@/types'
import { musicAudioFromApi, musicPlaybackDetailsFromApi, canPlayMusicSong } from '@mobile/mobileMusicPlayback'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'

export interface StarredViewItem {
  id: string
  title: string
  subtitle?: string
  kind: 'album' | 'playlist' | 'artist'
  cover_url?: string
}

const props = withDefaults(
  defineProps<{
    initialTab?: 'starred' | 'history' | 'playlists'
    initialStarred?: StarredViewItem[]
    initialHistory?: Song[]
    initialPlaylists?: MusicPlaylistSummary[]
  }>(),
  {
    initialTab: 'starred',
    initialStarred: undefined,
    initialHistory: undefined,
    initialPlaylists: undefined,
  }
)

const router = useRouter()
const authStore = useAuthStore()
const player = useAudioPlayerStore()

const isAuthenticated = computed(() => {
  if (
    props.initialStarred !== undefined ||
    props.initialHistory !== undefined ||
    props.initialPlaylists !== undefined
  ) {
    return true
  }
  return authStore.isAuthenticated || Boolean(authStore.user)
})

const activeTab = ref<'starred' | 'history' | 'playlists'>(props.initialTab)
const loading = ref(false)

const starredList = ref<StarredViewItem[]>(props.initialStarred ? [...props.initialStarred] : [])
const historyList = ref<Song[]>(props.initialHistory ? [...props.initialHistory] : [])
const userPlaylists = ref<MusicPlaylistSummary[]>(props.initialPlaylists ? [...props.initialPlaylists] : [])

const showCreatePlaylist = ref(false)
const newPlaylistName = ref('')

function toPlayerSong(item: any): Song {
  return {
    id: item.id,
    title: item.title,
    artist: typeof item.artist === 'string'
      ? item.artist
      : item.artists?.map((a: any) => a.name || a.display_name).join(' / ') || '未知艺术家',
    album: typeof item.album === 'string' ? item.album : item.album?.title || '',
    duration: typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (item.duration_sec ?? item.duration_seconds ?? item.durationSeconds ?? 0),
    ...musicAudioFromApi(item),
    ...musicPlaybackDetailsFromApi(item),
    cover_url: item.cover_url || item.album?.cover_url || '',
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function loadUserData() {
  if (props.initialStarred !== undefined && props.initialHistory !== undefined && props.initialPlaylists !== undefined) {
    return
  }

  loading.value = true
  try {
    const [albumBookmarksRes, artistBookmarksRes, playlistBookmarksRes, historyRes, playlistsRes] = await Promise.allSettled([
      listAlbumBookmarks({ page: 1, page_size: 50 }),
      listArtistBookmarks({ page: 1, page_size: 50 }),
      listPlaylistBookmarks({ page: 1, page_size: 50 }),
      listMusicListeningHistory({ page: 1, page_size: 50 }),
      listMusicPlaylists({ page: 1, page_size: 50 }),
    ])

    // Starred Items
    if (props.initialStarred === undefined) {
      const starred: StarredViewItem[] = []

      if (albumBookmarksRes.status === 'fulfilled' && albumBookmarksRes.value?.data) {
        for (const b of albumBookmarksRes.value.data) {
          starred.push({
            id: b.album_id || b.id,
            title: b.album?.title || '专辑',
            subtitle: b.album?.artists?.map((a: any) => a.name).join(' / ') || '收藏专辑',
            kind: 'album',
            cover_url: b.album?.cover_url,
          })
        }
      }

      if (artistBookmarksRes.status === 'fulfilled' && artistBookmarksRes.value?.data) {
        for (const b of artistBookmarksRes.value.data) {
          starred.push({
            id: b.artist_id || b.id,
            title: b.artist?.name || '艺术家',
            subtitle: '关注艺人',
            kind: 'artist',
            cover_url: b.artist?.image_url,
          })
        }
      }

      if (playlistBookmarksRes.status === 'fulfilled' && playlistBookmarksRes.value?.data) {
        for (const b of playlistBookmarksRes.value.data) {
          starred.push({
            id: b.playlist_id || b.id,
            title: b.playlist?.name || '歌单',
            subtitle: `${b.playlist?.song_count || 0} 首歌曲`,
            kind: 'playlist',
            cover_url: b.playlist?.cover_url,
          })
        }
      }

      starredList.value = starred
    }

    // History Items
    if (props.initialHistory === undefined) {
      if (historyRes.status === 'fulfilled' && historyRes.value?.data?.length) {
        historyList.value = historyRes.value.data.map((item: any) =>
          toPlayerSong(item.song ? item.song : item)
        )
      } else {
        historyList.value = []
      }
    }

    // Playlists Items
    if (props.initialPlaylists === undefined) {
      if (playlistsRes.status === 'fulfilled' && playlistsRes.value?.data?.length) {
        userPlaylists.value = playlistsRes.value.data
      } else {
        userPlaylists.value = []
      }
    }
  } catch {
    // Keep empty lists gracefully
  } finally {
    loading.value = false
  }
}

function openStarred(item: StarredViewItem) {
  if (item.kind === 'album') {
    void router.push(`/music/album/${item.id}`)
  } else if (item.kind === 'playlist') {
    void router.push(`/music/playlist/${item.id}`)
  } else {
    void router.push(`/music/artist/${item.id}`)
  }
}

function openPlaylist(id: string) {
  void router.push(`/music/playlist/${id}`)
}

function playSong(song: Song) {
  if (!canPlayMusicSong(song)) return
  player.playSong(song)
}

async function handleCreatePlaylist() {
  const name = newPlaylistName.value.trim()
  if (!name) return
  try {
    const res = await createMusicPlaylist({ name })
    const created: any = (res as any)?.data || res
    if (created?.id) {
      userPlaylists.value.unshift(created)
      newPlaylistName.value = ''
      showCreatePlaylist.value = false
      return
    }
  } catch {
    // Fallback client-side addition
  }
  userPlaylists.value.unshift({
    id: `local-${Date.now()}`,
    name,
    song_count: 0,
    is_public: false,
  })
  newPlaylistName.value = ''
  showCreatePlaylist.value = false
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await authStore.restoreSession().catch(() => {})
  }
  if (isAuthenticated.value) {
    void loadUserData()
  }
})
</script>

<style scoped>
.mobile-music-me {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: #ffffff;
  padding-bottom: 96px;
}

.mobile-music-me__guest-wrap {
  padding-top: 24px;
}

.mobile-music-me__header {
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-music-me__user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.mobile-music-me__avatar {
  flex-shrink: 0;
}

.mobile-music-me__user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-me__name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.mobile-music-me__handle {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.mobile-music-me__stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 12px 0;
  margin-bottom: 16px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
}

.mobile-music-me__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.mobile-music-me__stat-val {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.mobile-music-me__stat-label {
  font-size: 0.6875rem;
  color: var(--a-color-text-secondary, #64748b);
}

.mobile-music-me__stat-divider {
  width: 1px;
  height: 24px;
  background-color: var(--a-color-border-soft, #e2e8f0);
}

.mobile-music-me__tabs {
  display: flex;
  gap: 8px;
}

.mobile-music-me__tab {
  flex: 1;
  padding: 8px 0;
  background-color: transparent;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mobile-music-me__tab.is-active {
  background-color: var(--a-color-text-primary, #0f172a);
  color: #ffffff;
  border-color: var(--a-color-text-primary, #0f172a);
}

.mobile-music-me__content {
  padding: 16px;
}

.mobile-music-me__playlists-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.mobile-music-me__playlists-count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.mobile-music-me__create-box {
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  padding: 12px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-music-me__create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.mobile-music-me__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-music-me__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.mobile-music-me__item:active {
  background-color: #f8fafc;
}

.mobile-music-me__track-index {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-text-secondary, #94a3b8);
  width: 18px;
  text-align: center;
}

.mobile-music-me__item-cover {
  width: 44px;
  height: 44px;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  background-color: #f1f5f9;
  flex-shrink: 0;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.mobile-music-me__item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-me__item-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-secondary, #64748b);
}

.mobile-music-me__item-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-me__item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text-primary, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-me__item-sub {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-me__item-dur {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #94a3b8);
  font-variant-numeric: tabular-nums;
}

.mobile-music-me__arrow {
  color: var(--a-color-text-secondary, #94a3b8);
  flex-shrink: 0;
}

.mobile-music-me__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
}

.mobile-music-me__empty-icon {
  color: var(--a-color-border, #cbd5e1);
  margin-bottom: 12px;
}

.mobile-music-me__empty-title {
  margin: 0 0 6px 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--a-color-text-primary, #0f172a);
}

.mobile-music-me__empty-desc {
  margin: 0 0 16px 0;
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  max-width: 240px;
}

.mobile-music-me__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-music-me__skeleton {
  height: 56px;
  background-color: #f1f5f9;
  border-radius: var(--a-radius-card, 4px);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
