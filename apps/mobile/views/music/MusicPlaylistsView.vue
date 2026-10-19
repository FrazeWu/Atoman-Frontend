<template>
  <div class="mobile-music-playlists">
    <!-- Header -->
    <header class="mobile-music-playlists__header">
      <h1 class="mobile-music-playlists__title">歌单</h1>
      <MButton
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
      <div v-else class="mobile-music-playlists__empty" data-testid="empty-state">
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createMusicPlaylist,
  listMusicPlaylists,
  listPublicMusicPlaylists,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'

const router = useRouter()
const playlists = ref<MusicPlaylistSummary[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const newPlaylistName = ref('')

async function loadPlaylists() {
  loading.value = true
  try {
    const [userRes, publicRes] = await Promise.allSettled([
      listMusicPlaylists({ page: 1, page_size: 50 }),
      listPublicMusicPlaylists({ page: 1, page_size: 50 }),
    ])

    const list: MusicPlaylistSummary[] = []
    if (userRes.status === 'fulfilled' && userRes.value?.data?.length) {
      list.push(...userRes.value.data)
    }
    if (publicRes.status === 'fulfilled' && publicRes.value?.data?.length) {
      for (const p of publicRes.value.data) {
        if (!list.some((existing) => existing.id === p.id)) {
          list.push(p)
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
    // Keep dialog or handle fallback
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

onMounted(() => {
  void loadPlaylists()
})
</script>

<style scoped>
.mobile-music-playlists {
  padding: 1rem 1rem 5rem;
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
}

.mobile-music-playlists__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.mobile-music-playlists__title {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
}

.mobile-music-playlists__create-panel {
  margin-bottom: 1.25rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-surface-muted, #f8fafc);
}

.mobile-music-playlists__create-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: var(--a-color-text, #0f172a);
}

.mobile-music-playlists__create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.mobile-music-playlists__content {
  display: flex;
  flex-direction: column;
}

.mobile-music-playlists__list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  background: #ffffff;
  overflow: hidden;
}

.mobile-music-playlists__item {
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  gap: 0.875rem;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.1s ease;
}

.mobile-music-playlists__item:last-child {
  border-bottom: none;
}

.mobile-music-playlists__item:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.mobile-music-playlists__item-cover {
  width: 44px;
  height: 44px;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  background: var(--a-color-surface-muted, #f1f5f9);
  flex-shrink: 0;
}

.mobile-music-playlists__item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-playlists__item-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-muted, #94a3b8);
}

.mobile-music-playlists__item-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 0.125rem;
}

.mobile-music-playlists__item-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-music-playlists__item-count {
  font-size: 0.75rem;
  color: var(--a-color-muted, #64748b);
}

.mobile-music-playlists__item-arrow {
  flex-shrink: 0;
  color: var(--a-color-muted, #94a3b8);
}

.mobile-music-playlists__arrow-icon {
  transform: rotate(-90deg);
}

.mobile-music-playlists__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 1rem;
  color: var(--a-color-muted, #94a3b8);
  border: 1px dashed var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 4px);
  text-align: center;
}

.mobile-music-playlists__empty-icon {
  margin-bottom: 0.75rem;
  opacity: 0.6;
}

.mobile-music-playlists__empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin: 0 0 0.25rem;
}

.mobile-music-playlists__empty-desc {
  font-size: 0.8125rem;
  color: var(--a-color-muted, #64748b);
  margin: 0 0 1.25rem;
}
</style>
