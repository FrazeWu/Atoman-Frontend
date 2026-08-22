<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BarChart3, Clock3, Settings, Star } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { getMusicHome, listMusicLibrary, listMusicListeningHistory } from '@/api/musicV1'
import type { MusicAlbumBookmark, MusicArtistBookmark, MusicPlaylistBookmark } from '@/api/musicV1/types'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'

const authStore = useAuthStore()
const loading = ref(false)
const error = ref('')
const listenedCount = ref(0)
const favoriteCount = ref(0)
const recentCount = ref(0)

const isAuthenticated = computed(() => authStore.isAuthenticated && Boolean(authStore.user))

async function loadOverview() {
  if (!isAuthenticated.value) return
  loading.value = true
  error.value = ''
  try {
    const [history, albums, artists, playlists, home] = await Promise.all([
      listMusicListeningHistory({ page: 1, page_size: 1 }),
      listMusicLibrary<MusicAlbumBookmark>('album', { page: 1, page_size: 1 }),
      listMusicLibrary<MusicArtistBookmark>('artist', { page: 1, page_size: 1 }),
      listMusicLibrary<MusicPlaylistBookmark>('playlist', { page: 1, page_size: 1 }),
      getMusicHome(),
    ])
    listenedCount.value = history.meta.total
    favoriteCount.value = albums.meta.total + artists.meta.total + playlists.meta.total
    recentCount.value = home.recently_played.length
  } catch {
    error.value = '统计加载失败，请重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => void loadOverview())
</script>

<template>
  <div class="a-page-md music-profile-view">
    <PPageHeader title="我的" mb="1.25rem" />

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
      <div v-else class="music-profile__stats" aria-label="音乐统计">
        <article class="music-profile__stat">
          <BarChart3 :size="18" aria-hidden="true" />
          <strong>{{ listenedCount }}</strong>
          <span>听过的歌曲</span>
        </article>
        <article class="music-profile__stat">
          <Star :size="18" aria-hidden="true" />
          <strong>{{ favoriteCount }}</strong>
          <span>收藏内容</span>
        </article>
        <article class="music-profile__stat">
          <Clock3 :size="18" aria-hidden="true" />
          <strong>{{ recentCount }}</strong>
          <span>最近播放</span>
        </article>
      </div>

      <nav class="music-profile__links" aria-label="音乐个人入口">
        <RouterLink to="/music/history"><Clock3 :size="18" aria-hidden="true" /><span>播放历史</span></RouterLink>
        <RouterLink to="/music/bookmarks"><Star :size="18" aria-hidden="true" /><span>资料库</span></RouterLink>
        <RouterLink :to="authStore.user ? `/users/${authStore.user.username}/settings` : '/login'"><Settings :size="18" aria-hidden="true" /><span>音乐设置</span></RouterLink>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.music-profile-view { min-height: 100%; padding-bottom: 3rem; }
.music-profile__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
.music-profile__stat { display: grid; gap: 0.35rem; min-width: 0; padding: 1rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); }
.music-profile__stat strong { font-size: 1.35rem; font-weight: 500; }
.music-profile__stat span, .music-profile__state, .music-profile__error { color: var(--a-color-muted); font-size: 0.8rem; }
.music-profile__error { color: var(--a-color-danger); margin-bottom: 1rem; }
.music-profile__links { display: grid; gap: 0.5rem; }
.music-profile__links a { display: flex; min-height: 48px; align-items: center; gap: 0.65rem; padding: 0.75rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.music-profile__links a:hover, .music-profile__links a:focus-visible { border-color: var(--a-color-fg); }
@media (max-width: 520px) { .music-profile__stats { grid-template-columns: 1fr; } }
</style>
