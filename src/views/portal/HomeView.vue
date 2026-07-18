<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { listMusicArtists } from '@/api/musicV1'
import PInput from '@/components/ui/PInput.vue'

const player = usePlayerStore()
const authStore = useAuthStore()
player.fetchSongs()

interface ArtistOption { id: string; name: string }

const artists = ref<ArtistOption[]>([])
const selectedArtistName = ref('')
const searchQuery = ref('')
const showDropdown = ref(false)
const searchLoading = ref(false)

const dropdownArtists = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return q ? artists.value.filter((a) => a.name.toLowerCase().includes(q)) : artists.value
})

let searchTimer: ReturnType<typeof setTimeout>
watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchArtists(q), 300)
})

async function fetchArtists(q = '') {
  try {
    searchLoading.value = true
    const res = await listMusicArtists({
      q: q.trim() || undefined,
      page: 1,
      page_size: 24,
    })
    artists.value = res.data.map((artist) => ({
      id: artist.id,
      name: artist.name,
    }))
  } catch (e) {
    console.error('Failed to fetch artists:', e)
  } finally {
    searchLoading.value = false
  }
}

function selectArtist(name: string) {
  selectedArtistName.value = name
  searchQuery.value = ''
  showDropdown.value = false
}

function handleSearchFocus() {
  showDropdown.value = true
}

function handleSearchBlur() {
  window.setTimeout(() => {
    showDropdown.value = false
  }, 120)
}

function pickRandom() {
  if (artists.value.length > 0) {
    const pick = artists.value[Math.floor(Math.random() * artists.value.length)]
    selectedArtistName.value = pick.name
    searchQuery.value = ''
  }
}

const stopOnce = watch(
  () => player.songs.length,
  (len) => {
    if (len > 0 && !selectedArtistName.value) {
      const names = [...new Set(player.songs.map((s) => s.artist))]
      selectedArtistName.value = names[Math.floor(Math.random() * names.length)]
      stopOnce()
    }
  },
)

fetchArtists()
onUnmounted(() => clearTimeout(searchTimer))

interface AlbumGroup {
  album: string
  year: number
  release_date: string
  cover_url: string
  artist: string
  songs: typeof player.songs
}

const albumGroups = computed(() => {
  const songs = selectedArtistName.value
    ? player.songs.filter((s) => s.artist === selectedArtistName.value)
    : [...player.songs]

  const groups = new Map<string, AlbumGroup>()
  songs.forEach((song) => {
    const key = `${song.album}-${song.year}`
    if (!groups.has(key)) {
      groups.set(key, {
        album: song.album,
        year: song.year,
        release_date: song.release_date,
        cover_url: song.cover_url,
        artist: song.artist,
        songs: [],
      })
    }
    groups.get(key)!.songs.push(song)
  })
  return Array.from(groups.values()).sort((a, b) => b.year - a.year)
})

const shouldShowYear = (index: number) =>
  index === 0 || albumGroups.value[index - 1].year !== albumGroups.value[index].year
</script>

<template>
  <div class="home-view">
    <!-- Header -->
    <div class="home-header">
      <div class="header-top-row">
        <h1 class="home-title">
          {{ selectedArtistName || '音乐' }}<br />时间线
        </h1>
        <RouterLink v-if="authStore.isAuthenticated" to="/videos/upload" class="btn-upload">
          上传
        </RouterLink>
      </div>
      <p class="home-subtitle">
        浏览艺术家的唱片与重要作品。
      </p>

      <!-- Artist search -->
      <div class="search-row">
        <div class="search-surface">
          <div class="search-wrap">
            <div class="search-frame">
              <div class="search-frame__head">
                <span class="search-frame__eyebrow">艺术家搜索</span>
                <span v-if="selectedArtistName" class="search-frame__context">当前：{{ selectedArtistName }}</span>
              </div>
              <PInput
                v-model="searchQuery"
                @focus="handleSearchFocus"
                @blur="handleSearchBlur"
                placeholder="搜索艺术家..."
                class="search-input"
              />
            </div>

            <div v-if="showDropdown" class="search-dropdown">
              <p v-if="searchQuery.trim().length < 1" class="search-dropdown__hint">输入艺名，快速筛选时间线。</p>
              <p v-else-if="searchLoading" class="search-dropdown__hint">搜索中...</p>
              <p v-else-if="dropdownArtists.length === 0" class="search-dropdown__hint">没有匹配的艺术家</p>
              <div v-else class="search-dropdown__list">
                <button
                  v-for="artist in dropdownArtists"
                  :key="artist.id"
                  @mousedown.prevent="selectArtist(artist.name)"
                  class="search-item"
                  :class="{ active: artist.name === selectedArtistName }"
                >
                  <span class="search-item__label">{{ artist.name }}</span>
                  <span class="search-item__meta">艺术家</span>
                </button>
              </div>
            </div>
          </div>

          <div class="search-actions">
            <button @click="pickRandom" class="search-action search-action--primary">随机</button>
            <button v-if="selectedArtistName" @click="selectedArtistName = ''" class="search-action">
              全部
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="timeline-wrap" :style="{ minHeight: Math.max(albumGroups.length * 160, 400) + 'px' }">
      <div class="timeline-line" />

      <!-- Empty state -->
      <div v-if="albumGroups.length === 0" class="timeline-empty">
        <p>{{ player.songs.length === 0 ? '加载中...' : '该艺术家暂无专辑' }}</p>
      </div>

      <div class="albums-list">
        <div
          v-for="(albumGroup, index) in albumGroups"
          :key="`${albumGroup.album}-${albumGroup.year}`"
          class="album-row"
        >
          <!-- Year label -->
          <div v-if="shouldShowYear(index)" class="year-label">
            <span class="year-badge">{{ albumGroup.year }}</span>
          </div>

          <!-- Timeline node -->
          <div
            class="timeline-node"
            :class="{ playing: player.currentSong?.album === albumGroup.album }"
          />

          <!-- Album card -->
          <div class="album-card-wrap">
            <div class="album-card">
              <div class="album-card-inner">
                <img
                  :src="albumGroup.cover_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22%3E%3Crect width=%22128%22 height=%22128%22 fill=%22%23111%22/%3E%3C/svg%3E'"
                  class="album-cover"
                  :alt="albumGroup.album"
                />
                <div class="album-info">
                  <h3 class="album-title">{{ albumGroup.album }}</h3>
                  <p class="album-artist">{{ albumGroup.artist }}</p>
                  <p class="album-date">{{ albumGroup.release_date }}</p>
                  <p class="album-tracks">
                    {{ albumGroup.songs.length }}
                    {{ albumGroup.songs.length === 1 ? 'track' : 'tracks' }}
                  </p>

                  <div class="album-actions">
                    <button @click="player.playSong(albumGroup.songs[0])" class="btn-play">
                      ▶ 播放
                    </button>
                    <RouterLink
                      :to="`/artist=${encodeURIComponent(albumGroup.artist.replace(/ /g, '_'))}/album=${encodeURIComponent(albumGroup.album.replace(/ /g, '_'))}`"
                      class="btn-detail"
                    >
                      详情
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view { position: relative; padding-top: 3rem; padding-bottom: 12rem; }
.home-header { max-width: 72rem; margin: 0 auto; padding: 0 2rem; margin-bottom: 3rem; }
.header-top-row { display: flex; align-items: flex-start; justify-content: space-between; }
.btn-upload {
  margin-top: 0.5rem;
  border: 1px solid var(--a-color-text);
  padding: 0.5rem 1.25rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  text-decoration: none;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.btn-upload:hover { background: var(--a-color-bg); color: var(--a-color-text); }
.home-title {
  font-size: 2.5rem;
  font-weight: var(--a-font-weight-black, 900);
  font-style: italic;
  letter-spacing: 0;
  border-left: 4px solid var(--a-color-text);
  padding-left: 1.25rem;
  line-height: 1.1;
  margin: 0 0 0.75rem;
}
.home-subtitle { color: var(--a-color-muted); max-width: 32rem; font-size: 0.875rem; margin: 0 0 1.5rem; }
.search-row { display: flex; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap; }
.search-surface {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: min(100%, 34rem);
}
.search-wrap {
  position: relative;
  flex: 1;
  min-width: 18rem;
}
.search-frame {
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-bg) 94%, #f3eee5 6%);
  box-shadow: none;
  padding: 0.75rem 0.9rem 0.85rem;
  display: grid;
  gap: 0.55rem;
}
.search-frame__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.search-frame__eyebrow,
.search-frame__context {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}
.search-frame__eyebrow {
  color: var(--a-color-muted-soft);
}
.search-frame__context {
  color: var(--a-color-muted);
}
.search-input {
  width: 100%;
  background: transparent;
  color: var(--a-color-fg);
}
.search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  border: var(--a-border);
  background: color-mix(in srgb, var(--a-color-bg) 94%, #f3eee5 6%);
  box-shadow: none;
  max-height: 18rem;
  overflow-y: auto;
  padding: 0.45rem 0;
}
.search-dropdown__hint {
  margin: 0;
  padding: 0.5rem 0.9rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 500;
}
.search-dropdown__list {
  display: grid;
}
.search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  text-align: left;
  padding: 0.75rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 500;
  background: transparent;
  color: var(--a-color-fg);
  border: none;
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
  cursor: pointer;
  transition: all 0.1s ease;
}
.search-item:hover,
.search-item.active {
  background: color-mix(in srgb, var(--a-color-bg) 58%, var(--a-color-surface-muted) 42%);
  border-top-color: var(--a-color-border-soft);
  border-bottom-color: var(--a-color-border-soft);
}
.search-item__label {
  font-weight: 500;
}
.search-item__meta {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--a-color-muted-soft);
}
.search-actions {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}
.search-action {
  border: 0;
  border-right: 1px solid var(--a-color-border-soft);
  padding: 0.8rem 1rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}
.search-action:last-child {
  border-right: none;
}
.search-action:hover {
  background: var(--a-color-surface-muted);
}
.search-action--primary {
  font-weight: 500;
}

/* Timeline */
.timeline-wrap {
  position: relative;
  max-width: 72rem;
  margin: 0 auto;
  padding: 0 2rem;
}
.timeline-line {
  position: absolute;
  left: calc(33.333% + 2rem);
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--a-color-border-soft);
  z-index: 0;
}
.timeline-empty {
  position: relative;
  z-index: 10;
  margin-left: calc(33.333% + 2rem);
  padding-top: 4rem;
  color: var(--a-color-disabled-fg);
  font-weight: 500;
}
.albums-list { display: flex; flex-direction: column; gap: 6rem; position: relative; z-index: 10; }
.album-row { position: relative; display: flex; align-items: center; }
.year-label {
  position: absolute;
  left: 33.333%;
  transform: translateX(-50%);
  top: -3rem;
  z-index: 20;
}
.year-badge {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
  border: 1px solid var(--a-color-border-soft);
  padding: 0.25rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0;
}
.timeline-node {
  position: absolute;
  left: 33.333%;
  transform: translateX(-50%);
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid var(--a-color-border);
  background: var(--a-color-bg);
  z-index: 20;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.timeline-node.playing { transform: translateX(-50%) scale(1.3); border-color: var(--a-color-text); background: var(--a-color-text); }
.album-card-wrap {
  margin-left: calc(33.333% + 2rem);
  width: calc(66.666% - 2rem);
}
.album-card {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  padding: 1.5rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.album-card:hover { border-color: var(--a-color-border); box-shadow: none; }
.album-card-inner { display: flex; gap: 1.5rem; }
.album-cover {
  width: 128px;
  height: 128px;
  border: 1px solid var(--a-color-border-soft);
  object-fit: cover;
  flex-shrink: 0;
  filter: grayscale(1);
}
.album-info { display: flex; flex-direction: column; justify-content: center; flex: 1; }
.album-title {
  font-size: 1.35rem;
  font-weight: var(--a-font-weight-black, 900);
  letter-spacing: 0;
  line-height: 1.2;
  margin: 0 0 0.25rem;
}
.album-artist { font-size: 0.875rem; font-weight: 500; color: var(--a-color-text-secondary); margin: 0 0 0.25rem; }
.album-date { font-size: 0.75rem; color: var(--a-color-muted); margin: 0 0 0.25rem; }
.album-tracks { font-size: 0.75rem; color: var(--a-color-muted-soft); margin: 0; }
.album-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
.btn-play, .btn-detail {
  border: 1px solid var(--a-color-border);
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0;
  background: var(--a-color-bg);
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  color: var(--a-color-text);
  display: inline-block;
}
.btn-play:hover, .btn-detail:hover { background: var(--a-color-text); color: var(--a-color-bg); border-color: var(--a-color-text); }

@media (max-width: 720px) {
  .search-surface {
    width: 100%;
  }

  .search-wrap {
    min-width: 100%;
  }

  .search-actions {
    width: 100%;
  }

  .search-action {
    flex: 1;
  }
}
</style>
