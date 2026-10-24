<template>
  <div class="mobile-music-playlists">
    <!-- Header -->
    <header class="mobile-music-playlists__header">
      <h1 class="mobile-music-playlists__title">歌单</h1>
      <MButton
        v-if="authStore.isAuthenticated && activeTab === 'mine'"
        size="sm"
        variant="secondary"
        class="mobile-music-playlists__create-btn"
        data-testid="create-playlist-btn"
        @click="showCreateModal = true"
      >
        <MIcon name="plus" size="xs" />
        <span>新建歌单</span>
      </MButton>
    </header>

    <!-- Sub Tabs: 我的歌单 vs 精选歌单 -->
    <div class="mobile-music-playlists__tabs">
      <button
        type="button"
        class="mobile-music-playlists__tab"
        :class="{ 'is-active': activeTab === 'mine' }"
        data-testid="tab-mine"
        @click="activeTab = 'mine'"
      >
        我的歌单
      </button>
      <button
        type="button"
        class="mobile-music-playlists__tab"
        :class="{ 'is-active': activeTab === 'curated' }"
        data-testid="tab-curated"
        @click="activeTab = 'curated'"
      >
        精选推荐
      </button>
    </div>

    <!-- Curated Tab -->
    <section v-if="activeTab === 'curated'" class="mobile-music-playlists__content" aria-label="精选歌单">
      <div v-if="curatedPlaylists.length > 0" class="mobile-music-playlists__list">
        <div
          v-for="pl in curatedPlaylists"
          :key="pl.id"
          class="mobile-music-playlists__item"
          data-testid="curated-playlist-item"
          @click="openPlaylist(pl.id)"
        >
          <div class="mobile-music-playlists__item-cover">
            <img
              v-if="pl.cover_url"
              :src="pl.cover_url"
              :alt="pl.name"
              class="mobile-music-playlists__item-img"
            />
            <div v-else class="mobile-music-playlists__item-art">
              <MIcon name="playlists" size="md" />
            </div>
          </div>

          <div class="mobile-music-playlists__item-meta">
            <span class="mobile-music-playlists__item-name">{{ pl.name }}</span>
            <span class="mobile-music-playlists__item-count">{{ pl.song_count || 0 }} 首歌曲</span>
          </div>

          <div class="mobile-music-playlists__item-arrow">
            <MIcon name="chevron-down" size="sm" class="mobile-music-playlists__arrow-icon" />
          </div>
        </div>
      </div>

      <!-- Loading / Empty Curated -->
      <div v-else-if="!loading" class="mobile-music-playlists__empty">
        <MIcon name="playlists" size="lg" class="mobile-music-playlists__empty-icon" />
        <p class="mobile-music-playlists__empty-title">暂无精选歌单</p>
      </div>
    </section>

    <!-- Mine Tab -->
    <template v-else>
      <!-- Guest State -->
      <div v-if="!authStore.isAuthenticated" class="mobile-music-playlists__guest">
        <MGuestCard
          title="登录开启自建歌单"
          description="登录后可创建专属歌单、收藏喜爱的曲目并在多端同步。"
          icon="playlists"
        />
      </div>

      <!-- Authenticated State -->
      <template v-else>
        <!-- Create Playlist Form/Sheet if open -->
        <div v-if="showCreateModal" class="mobile-music-playlists__create-panel" data-testid="create-panel">
          <div class="mobile-music-playlists__create-content">
            <h3 class="mobile-music-playlists__create-title">新建歌单</h3>
            <MInput
              v-model="newPlaylistName"
              placeholder="歌单名称..."
              clearable
            />
            <div class="mobile-music-playlists__create-actions">
              <MButton size="sm" variant="ghost" @click="showCreateModal = false">取消</MButton>
              <MButton size="sm" variant="primary" :disabled="!newPlaylistName.trim()" @click="handleCreate">确定</MButton>
            </div>
          </div>
        </div>

        <!-- Playlists Content -->
        <section class="mobile-music-playlists__content" aria-label="歌单列表">
          <div v-if="playlists.length > 0" class="mobile-music-playlists__list">
            <div
              v-for="playlist in playlists"
              :key="playlist.id"
              class="mobile-music-playlists__item"
              data-testid="playlist-item"
              @click="openPlaylist(playlist.id)"
            >
              <div class="mobile-music-playlists__item-cover">
                <img
                  v-if="playlist.cover_url"
                  :src="playlist.cover_url"
                  :alt="playlist.name"
                  class="mobile-music-playlists__item-img"
                />
                <div v-else class="mobile-music-playlists__item-art">
                  <MIcon name="playlists" size="md" />
                </div>
              </div>

              <div class="mobile-music-playlists__item-meta">
                <span class="mobile-music-playlists__item-name">{{ playlist.name }}</span>
                <span class="mobile-music-playlists__item-count">{{ playlist.song_count || 0 }} 首歌曲</span>
              </div>

              <div class="mobile-music-playlists__item-arrow">
                <MIcon name="chevron-down" size="sm" class="mobile-music-playlists__arrow-icon" />
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="!loading" class="mobile-music-playlists__empty" data-testid="empty-state">
            <MIcon name="playlists" size="lg" class="mobile-music-playlists__empty-icon" />
            <p class="mobile-music-playlists__empty-title">暂无歌单</p>
            <p class="mobile-music-playlists__empty-desc">创建专属歌单，收藏你喜爱的曲目</p>
            <MButton
              size="sm"
              variant="secondary"
              @click="showCreateModal = true"
            >
              <MIcon name="plus" size="xs" />
              <span>新建歌单</span>
            </MButton>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  createMusicPlaylist,
  listMusicPlaylists,
  listPlaylistBookmarks,
  listPublicMusicPlaylists,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'

const props = withDefaults(
  defineProps<{
    initialTab?: 'mine' | 'curated'
  }>(),
  {
    initialTab: 'mine',
  }
)

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'mine' | 'curated'>(props.initialTab)
const playlists = ref<MusicPlaylistSummary[]>([])
const curatedPlaylists = ref<MusicPlaylistSummary[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const newPlaylistName = ref('')

const fallbackCurated: MusicPlaylistSummary[] = [
  { id: 'curated-1', name: '深度工作流', song_count: 18, is_public: true },
  { id: 'curated-2', name: '午夜脉冲', song_count: 24, is_public: true },
  { id: 'curated-3', name: '极简专注音', song_count: 15, is_public: true },
  { id: 'curated-4', name: '环境氛围志', song_count: 20, is_public: true },
]

async function loadCuratedPlaylists() {
  try {
    const res = await listPublicMusicPlaylists({ page: 1, page_size: 30 })
    if (res?.data?.length) {
      curatedPlaylists.value = res.data
    } else {
      curatedPlaylists.value = fallbackCurated
    }
  } catch {
    curatedPlaylists.value = fallbackCurated
  }
}

async function loadPlaylists() {
  void loadCuratedPlaylists()
  if (!authStore.isAuthenticated) {
    playlists.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const [userRes, bookmarkRes] = await Promise.allSettled([
      listMusicPlaylists({ page: 1, page_size: 100 }),
      listPlaylistBookmarks({ page: 1, page_size: 100 }),
    ])

    const list: MusicPlaylistSummary[] = []
    if (userRes.status === 'fulfilled' && userRes.value?.data?.length) {
      list.push(...userRes.value.data.filter((p) => p.kind !== 'later'))
    }
    if (bookmarkRes.status === 'fulfilled' && bookmarkRes.value?.data?.length) {
      for (const b of bookmarkRes.value.data) {
        const pl = b.playlist
        if (pl && !list.some((existing) => existing.id === pl.id)) {
          list.push(pl)
        }
      }
    }
    playlists.value = list
  } catch {
    playlists.value = []
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  const name = newPlaylistName.value.trim()
  if (!name) return
  try {
    const res = await createMusicPlaylist({ name })
    if (res?.id) {
      playlists.value.unshift(res)
    }
    newPlaylistName.value = ''
    showCreateModal.value = false
  } catch {
    playlists.value.unshift({
      id: `local-${Date.now()}`,
      name,
      song_count: 0,
      is_public: false,
    })
    newPlaylistName.value = ''
    showCreateModal.value = false
  }
}

function openPlaylist(id: string) {
  void router.push(`/music/playlist/${id}`)
}

watch(
  () => route.query?.tab,
  (tab) => {
    if (tab === 'curated' || tab === 'mine') {
      activeTab.value = tab
    }
  }
)

watch(
  () => authStore.isAuthenticated,
  () => {
    void loadPlaylists()
  }
)

onMounted(() => {
  if (route.query?.tab === 'curated' || route.query?.tab === 'mine') {
    activeTab.value = route.query.tab
  }
  void loadPlaylists()
})

onActivated(() => {
  void loadPlaylists()
})
</script>

<style scoped>
.mobile-music-playlists {
  padding: 1rem 1rem 5rem;
  padding-bottom: var(--mobile-music-page-bottom, 5rem);
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
}

.mobile-music-playlists__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.mobile-music-playlists__title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin: 0;
}

.mobile-music-playlists__tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  padding-bottom: 8px;
}

.mobile-music-playlists__tab {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #666666);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mobile-music-playlists__tab.is-active {
  color: #ffffff;
  background-color: var(--a-color-primary, #111111);
}

.mobile-music-playlists__guest {
  padding: 1rem 0;
}

.mobile-music-playlists__create-panel {
  background-color: var(--a-color-surface-subtle, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.mobile-music-playlists__create-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.mobile-music-playlists__create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.mobile-music-playlists__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mobile-music-playlists__item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  background-color: #ffffff;
  border: 1px solid var(--a-color-border-soft, #f1f5f9);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.mobile-music-playlists__item:active {
  background-color: var(--a-color-surface-hover, #f8fafc);
  border-color: var(--a-color-border, #cbd5e1);
}

.mobile-music-playlists__item-cover {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: var(--a-color-surface-subtle, #f1f5f9);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-music-playlists__item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-playlists__item-art {
  color: var(--a-color-text-muted, #94a3b8);
}

.mobile-music-playlists__item-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mobile-music-playlists__item-name {
  font-size: 0.9375rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-playlists__item-count {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.mobile-music-playlists__item-arrow {
  color: var(--a-color-text-muted, #94a3b8);
  display: flex;
  align-items: center;
}

.mobile-music-playlists__arrow-icon {
  transform: rotate(-90deg);
}

.mobile-music-playlists__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.mobile-music-playlists__empty-icon {
  color: var(--a-color-text-muted, #94a3b8);
  margin-bottom: 0.75rem;
}

.mobile-music-playlists__empty-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.mobile-music-playlists__empty-desc {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0 0 1rem;
}
</style>
