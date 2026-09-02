<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { IconPlus as Plus, IconRefresh as RefreshCw, IconX as X } from '@tabler/icons-vue'
import {
  createMusicPlaylist,
  deletePlaylistBookmark,
  listMusicPlaylists,
  listPlaylistBookmarks,
  type MusicPlaylistSummary,
} from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'
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
const createFormVisible = ref(false)
const createPending = ref(false)
const createError = ref('')
const newPlaylistName = ref('')
const createNameInput = ref<HTMLInputElement | null>(null)

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
    ownedPlaylists.value = ownedResponse.data.filter(playlist => playlist.kind !== 'later')
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

function openCreateForm() {
  if (!isAuthenticated.value) return
  createFormVisible.value = true
  createError.value = ''
  void nextTick(() => createNameInput.value?.focus())
}

function closeCreateForm() {
  createFormVisible.value = false
  createError.value = ''
  newPlaylistName.value = ''
}

async function submitCreatePlaylist() {
  const name = newPlaylistName.value.trim()
  if (!name || createPending.value) {
    createError.value = name ? '' : '请输入歌单名称'
    return
  }
  createPending.value = true
  createError.value = ''
  try {
    const created = await createMusicPlaylist({ name, is_public: false })
    closeCreateForm()
    await loadPlaylists()
    openPlaylist(String(created.id))
  } catch {
    createError.value = '创建歌单失败，请重试'
  } finally {
    createPending.value = false
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
  <main class="music-playlists-view">
    <PPageHeader title="歌单" mb="1.25rem">
      <template #action>
        <div v-if="isAuthenticated" class="music-playlists__header-actions">
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
          <PButton
            type="button"
            variant="primary"
            data-testid="create-playlist"
            :disabled="createPending"
            @click="openCreateForm"
          >
            <Plus :size="16" aria-hidden="true" />
            <span>新建歌单</span>
          </PButton>
        </div>
      </template>
    </PPageHeader>

    <form
      v-if="createFormVisible"
      class="music-playlists__create-form"
      data-testid="create-playlist-form"
      @submit.prevent="submitCreatePlaylist"
    >
      <div class="music-playlists__create-field">
        <label for="music-playlist-name">歌单名称</label>
        <input
          id="music-playlist-name"
          ref="createNameInput"
          v-model="newPlaylistName"
          data-testid="create-playlist-name"
          type="text"
          maxlength="120"
          autocomplete="off"
          placeholder="例如：周末散步"
          :disabled="createPending"
        />
      </div>
      <div class="music-playlists__create-actions">
        <PButton
          type="submit"
          variant="primary"
          :loading="createPending"
          data-testid="create-playlist-submit"
          @click="submitCreatePlaylist"
        >
          创建
        </PButton>
        <button
          type="button"
          class="music-playlists__create-cancel"
          :disabled="createPending"
          @click="closeCreateForm"
        >
          <X :size="16" aria-hidden="true" />
          <span>取消</span>
        </button>
      </div>
      <p v-if="createError" class="music-playlists__form-error" role="alert">{{ createError }}</p>
    </form>

    <PEmpty
      v-if="!isAuthenticated"
      title="登录后查看歌单"
      description="登录后可以查看自己创建和收藏的歌单。"
    >
      <template #action>
        <RouterLink to="/login" class="a-btn a-btn--primary">登录</RouterLink>
      </template>
    </PEmpty>

    <p v-else-if="loading" class="music-playlists__state" aria-live="polite">正在加载歌单...</p>
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
  display: grid;
  max-width: 72rem;
  min-height: 100%;
  margin: 0 auto;
  padding: 1.5rem 0 3rem;
}

.music-playlists__header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.music-playlists__header-actions :deep(.p-button) {
  min-height: 44px;
}

.music-playlists__refresh {
  display: inline-grid;
  width: 44px;
  height: 44px;
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

.music-playlists__create-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.music-playlists__create-field {
  display: grid;
  gap: 0.4rem;
}

.music-playlists__create-field label {
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
}

.music-playlists__create-field input {
  min-height: 44px;
  width: 100%;
  padding: 0 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 8px;
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  font: inherit;
}

.music-playlists__create-field input:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.music-playlists__create-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.music-playlists__create-cancel {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 8px;
  background: transparent;
  color: var(--a-color-fg);
  font: inherit;
  cursor: pointer;
}

.music-playlists__create-cancel:hover,
.music-playlists__create-cancel:focus-visible {
  background: var(--a-color-surface);
}

.music-playlists__create-cancel:disabled {
  cursor: default;
  opacity: 0.55;
}

.music-playlists__form-error,
.music-playlists__state,
.music-playlists__empty {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.music-playlists__form-error,
.music-playlists__state--error {
  color: var(--a-color-danger, #ff3b30);
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1.25rem 1rem;
}

@keyframes music-playlists-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1100px) {
  .music-playlists-view { padding-inline: 1rem; }
  .music-playlists__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .music-playlists-view { padding: 1.25rem 1rem 3rem; }
  .music-playlists__header-actions { width: 100%; justify-content: flex-start; }
  .music-playlists__create-form { grid-template-columns: minmax(0, 1fr); }
  .music-playlists__create-actions { justify-content: flex-end; }
  .music-playlists__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem 1rem; }
}

@media (prefers-reduced-motion: reduce) {
  .music-playlists__refresh .is-spinning { animation: none; }
}
</style>
