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
  }
}

function selectArtist(name: string) {
  selectedArtistName.value = name
  searchQuery.value = ''
  showDropdown.value = false
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
          {{ selectedArtistName ? selectedArtistName.toUpperCase() : 'ATOMAN' }}<br />TIMELINE
        </h1>
        <RouterLink v-if="authStore.isAuthenticated" to="/videos/upload" class="btn-upload">
          上传
        </RouterLink>
      </div>
      <p class="home-subtitle">
        An interactive archival project. Browse the complete discography of any artist.
      </p>

      <!-- Artist search -->
      <div class="search-row">
        <div class="search-wrap">
          <PInput
            v-model="searchQuery"
            @focus="showDropdown = true"
            @blur="showDropdown = false"
            placeholder="搜索艺术家..."
            class="search-input"
          />
          <div v-if="showDropdown && dropdownArtists.length > 0" class="search-dropdown">
            <button
              v-for="artist in dropdownArtists"
              :key="artist.id"
              @mousedown.prevent="selectArtist(artist.name)"
              class="search-item"
              :class="{ active: artist.name === selectedArtistName }"
            >
              {{ artist.name }}
            </button>
          </div>
        </div>

        <button @click="pickRandom" class="btn-random">随机</button>

        <button v-if="selectedArtistName" @click="selectedArtistName = ''" class="btn-all">
          全部
        </button>
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
  border: 1px solid var(--a-color-ink);
  padding: 0.5rem 1.25rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  text-decoration: none;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.btn-upload:hover { background: var(--a-color-paper); color: var(--a-color-ink); }
.home-title {
  font-size: 2.5rem;
  font-weight: var(--a-font-weight-black, 900);
  font-style: italic;
  letter-spacing: -0.03em;
  border-left: 4px solid var(--a-color-ink);
  padding-left: 1.25rem;
  line-height: 1.1;
  margin: 0 0 0.75rem;
}
.home-subtitle { color: var(--a-color-muted); max-width: 32rem; font-size: 0.875rem; margin: 0 0 1.5rem; }
.search-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.search-wrap { position: relative; }
.search-input {
  border: 1px solid var(--a-color-line);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  transition: border-color 0.15s ease;
  width: 240px;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}
.search-input:focus { border-color: var(--a-color-fg); }
.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 50;
  width: 240px;
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line);
  border-top: none;
  max-height: 208px;
  overflow-y: auto;
}
.search-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--a-color-paper);
  color: var(--a-color-fg);
  border: none;
  cursor: pointer;
  transition: all 0.1s ease;
}
.search-item:hover, .search-item.active { background: var(--a-color-ink); color: var(--a-color-paper); }
.btn-random, .btn-all {
  border: 1px solid var(--a-color-line);
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-random:hover, .btn-all:hover { background: var(--a-color-paper-wash); }
.btn-all { border-color: var(--a-color-line-soft); color: var(--a-color-muted); }

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
  background: var(--a-color-line-soft);
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
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink-muted);
  border: 1px solid var(--a-color-line-soft);
  padding: 0.25rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.timeline-node {
  position: absolute;
  left: 33.333%;
  transform: translateX(-50%);
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  border: 2px solid var(--a-color-line);
  background: var(--a-color-bg);
  z-index: 20;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.timeline-node.playing { transform: translateX(-50%) scale(1.3); border-color: var(--a-color-ink); background: var(--a-color-ink); }
.album-card-wrap {
  margin-left: calc(33.333% + 2rem);
  width: calc(66.666% - 2rem);
}
.album-card {
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line-soft);
  padding: 1.5rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.album-card:hover { border-color: var(--a-color-line); box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
.album-card-inner { display: flex; gap: 1.5rem; }
.album-cover {
  width: 128px;
  height: 128px;
  border: 1px solid var(--a-color-line-soft);
  object-fit: cover;
  flex-shrink: 0;
  filter: grayscale(1);
}
.album-info { display: flex; flex-direction: column; justify-content: center; flex: 1; }
.album-title {
  font-size: 1.35rem;
  font-weight: var(--a-font-weight-black, 900);
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 0 0 0.25rem;
}
.album-artist { font-size: 0.875rem; font-weight: 700; color: var(--a-color-ink-muted); margin: 0 0 0.25rem; }
.album-date { font-size: 0.75rem; color: var(--a-color-muted); margin: 0 0 0.25rem; }
.album-tracks { font-size: 0.75rem; color: var(--a-color-muted-soft); margin: 0; }
.album-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
.btn-play, .btn-detail {
  border: 1px solid var(--a-color-line);
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--a-color-paper);
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  color: var(--a-color-ink);
  display: inline-block;
}
.btn-play:hover, .btn-detail:hover { background: var(--a-color-ink); color: var(--a-color-paper); border-color: var(--a-color-ink); }
</style>
