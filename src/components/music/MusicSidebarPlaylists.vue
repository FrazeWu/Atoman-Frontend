<!-- web/src/components/music/MusicSidebarPlaylists.vue -->
<template>
  <section class="music-sidebar-playlists" :class="{ 'is-collapsed': collapsed }" aria-label="歌单类别">
    <template v-if="!collapsed">
      <header class="music-sidebar-playlists__header">
        <p class="music-sidebar-playlists__eyebrow a-font-meta">我的歌单</p>
        <button
          type="button"
          class="create-playlist-btn"
          title="新建歌单"
          @click="startCreatePlaylist"
        >
          <Plus :size="14" />
        </button>
      </header>

      <div class="music-sidebar-playlists__items">
        <!-- Inline creation input -->
        <div v-if="isCreating" class="create-playlist-input-container">
          <input
            ref="inputRef"
            v-model="newPlaylistName"
            type="text"
            class="playlist-input"
            placeholder="输入歌单名称..."
            @keydown.enter="submitNewPlaylist"
            @keydown.esc="cancelCreatePlaylist"
            @blur="handleInputBlur"
          />
        </div>

        <button
          v-for="playlist in playlists"
          :key="playlist.id"
          type="button"
          class="music-sidebar-playlists__item"
          :class="{ 'is-active': String(playlist.id) === String(state.playlistId) }"
          @click="openPlaylist(String(playlist.id))"
        >
          <span class="playlist-icon-frame">
            <ListMusic :size="15" />
          </span>
          <span class="music-sidebar-playlists__name">{{ playlist.name }}</span>
        </button>
        
        <p v-if="!playlists.length && !isCreating" class="music-sidebar-playlists__empty">暂无歌单</p>
      </div>
    </template>
    <template v-else>
      <div class="collapsed-icons">
        <button
          type="button"
          class="collapsed-icon-btn collapsed-plus"
          title="新建歌单"
          @click="startCreatePlaylistFromCollapsed"
        >
          <Plus :size="20" />
        </button>
        <button
          v-for="playlist in playlists"
          :key="playlist.id"
          type="button"
          class="collapsed-icon-btn"
          :class="{ 'is-active': String(playlist.id) === String(state.playlistId) }"
          :title="playlist.name"
          @click="openPlaylist(String(playlist.id))"
        >
          <ListMusic :size="20" />
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { useRoute } from 'vue-router'
import { ListMusic, Plus } from 'lucide-vue-next'
import { listMusicPlaylists, createMusicPlaylist, type MusicPlaylistSummary } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

defineProps<{
  collapsed?: boolean
}>()

const playlists = ref<MusicPlaylistSummary[]>([])
const route = useRoute()
const { state, openPlaylist } = useMusicDrawers()

const isCreating = ref(false)
const newPlaylistName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

async function fetchPlaylists() {
  try {
    const response = await listMusicPlaylists()
    const list = [...(response.data || [])]
    list.sort((a, b) => {
      const aIsFav = a.name === '最爱' || a.name === '我喜欢的单曲' || a.name === '我喜欢'
      const bIsFav = b.name === '最爱' || b.name === '我喜欢的单曲' || b.name === '我喜欢'
      if (aIsFav && !bIsFav) return -1
      if (!aIsFav && bIsFav) return 1
      return 0
    })
    playlists.value = list
  } catch (error) {
    if (error instanceof ApiErrorResponseError && error.status === 401) {
      playlists.value = []
      return
    }
    console.error('Failed to fetch sidebar playlists:', error)
  }
}

function startCreatePlaylist() {
  isCreating.value = true
  newPlaylistName.value = ''
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function startCreatePlaylistFromCollapsed() {
  const name = prompt('请输入新建歌单名称：')
  if (name && name.trim()) {
    createPlaylistWithName(name.trim())
  }
}

function cancelCreatePlaylist() {
  isCreating.value = false
  newPlaylistName.value = ''
}

function handleInputBlur() {
  // Wait slightly to check if keydown actions are taking place
  setTimeout(() => {
    if (isCreating.value) {
      if (newPlaylistName.value.trim()) {
        submitNewPlaylist()
      } else {
        cancelCreatePlaylist()
      }
    }
  }, 150)
}

async function createPlaylistWithName(name: string) {
  try {
    const created = await createMusicPlaylist({ name })
    await fetchPlaylists()
    openPlaylist(String(created.id))
  } catch (error) {
    console.error('Failed to create playlist:', error)
  }
}

async function submitNewPlaylist() {
  const name = newPlaylistName.value.trim()
  if (!name) {
    cancelCreatePlaylist()
    return
  }
  isCreating.value = false
  await createPlaylistWithName(name)
  newPlaylistName.value = ''
}

watch(
  () => route.path,
  () => {
    fetchPlaylists()
  }
)

onMounted(() => {
  fetchPlaylists()
})
</script>

<style scoped>
.music-sidebar-playlists {
  display: grid;
  gap: 0.8rem;
  padding: 1.2rem 1.15rem;
  background: var(--a-color-paper);
  color: var(--a-color-fg);
}

.music-sidebar-playlists.is-collapsed {
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.music-sidebar-playlists__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.create-playlist-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-ink-soft);
  opacity: 0.6;
  cursor: pointer;
  padding: 0.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.create-playlist-btn:hover {
  opacity: 1;
  color: var(--a-color-ink);
}

.create-playlist-input-container {
  padding: 0.2rem 0.5rem;
}

.playlist-input {
  width: 100%;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
  color: var(--a-color-fg);
  font-size: 0.8rem;
  padding: 0.35rem 0.5rem;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.playlist-input:focus {
  border-color: var(--a-color-ink);
}

.collapsed-plus {
  color: var(--a-color-ink-soft);
  opacity: 0.8;
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.music-sidebar-playlists__eyebrow {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  font-family: var(--a-font-meta);
  text-transform: uppercase;
}

.music-sidebar-playlists__items {
  display: grid;
  gap: 0.2rem;
}

.music-sidebar-playlists__item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  border: 0;
  padding: 0.45rem 0.5rem;
  background: transparent;
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
  border-radius: 0px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.music-sidebar-playlists__item:hover {
  background-color: var(--a-color-paper-wash);
}

.music-sidebar-playlists__item:hover .music-sidebar-playlists__name {
  color: var(--a-color-fg);
}

.music-sidebar-playlists__item.is-active {
  background-color: var(--a-color-paper-wash);
  font-weight: 800;
  border-left: 2px solid var(--a-color-ink);
  padding-left: calc(0.5rem - 2px);
}

.playlist-icon-frame {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-ink-soft);
  opacity: 0.7;
  flex-shrink: 0;
}

.music-sidebar-playlists__item.is-active .playlist-icon-frame {
  color: var(--a-color-ink);
  opacity: 1;
}

.music-sidebar-playlists__name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--a-color-ink-soft);
}

.music-sidebar-playlists__empty {
  margin: 0;
  padding: 0.5rem;
  color: var(--a-color-ink-soft);
  font-size: 0.75rem;
  font-family: var(--a-font-meta);
  font-weight: 700;
}

/* Collapsed styling */
.collapsed-icons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  align-items: center;
}

.collapsed-icon-btn {
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-ink-soft);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.collapsed-icon-btn:hover {
  background-color: var(--a-color-paper-wash);
  color: var(--a-color-fg);
}

.collapsed-icon-btn.is-active {
  background-color: var(--a-color-paper-wash);
  color: var(--a-color-ink);
  border-left: 3px solid var(--a-color-ink);
}
</style>
