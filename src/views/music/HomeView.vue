<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'
import { useApi } from '@/composables/useApi'

const api = useApi()
const { isMainShifted, openArtist, openNestedAction } = useMusicDrawers()

const artists = ref<any[]>([])
const searchQuery = ref('')

async function fetchArtists() {
  try {
    const res = await fetch(`${api.url}/artists`)
    if (res.ok) {
      artists.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to fetch artists:', e)
  }
}

onMounted(() => {
  fetchArtists()
})
</script>

<template>
  <div class="music-base-view">
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <h1 class="page-title">艺术家</h1>
      <p class="a-muted">浏览音乐档案库中的所有艺术家。</p>

      <div class="search-bar">
        <input
          v-model="searchQuery"
          placeholder="搜索艺术家..."
          class="search-input"
        />
        <button class="a-btn" @click="openNestedAction('add_artist')">找不到？添加艺术家</button>
      </div>

      <div class="grid">
        <div 
          v-for="artist in artists" 
          :key="artist.id" 
          class="card"
          @click="openArtist(String(artist.id))"
        >
          <div class="card-img">
            <img v-if="artist.image_url" :src="artist.image_url" class="artist-avatar" />
            <span v-else>ARTIST</span>
          </div>
          <div class="card-body">
            <div class="card-title">{{ artist.name }}</div>
            <div class="card-sub">{{ artist.entry_status === 'confirmed' ? '已确认' : '未确认' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Drawers injected at root level of module view -->
    <ArtistDrawer />
    <AlbumDrawer />
    <NestedActionDrawer />
  </div>
</template>

<style scoped>
.music-base-view { position: relative; }
.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}
.main-level-1.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.4;
  pointer-events: none;
}
.page-title { font-family: var(--a-font-serif); font-size: 3rem; font-weight: 900; margin-bottom: 0.5rem; font-style: italic; border-left: 8px solid var(--a-color-ink); padding-left: 1rem; }
.search-bar { display: flex; gap: 1rem; margin: 2rem 0; }
.search-input { border: 2px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-size: 1rem; flex: 1; max-width: 400px; outline: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
.card { background: var(--a-color-paper); border: 2px solid var(--a-color-ink); display: flex; flex-direction: column; cursor: pointer; transition: transform 0.1s; }
.card:hover { transform: translateY(-4px); box-shadow: 6px 6px 0 0 rgba(0,0,0,0.1); }
.card-img { aspect-ratio: 1; background: #eee; border-bottom: 2px solid var(--a-color-ink); display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); color: #999; overflow: hidden; }
.artist-avatar { width: 100%; height: 100%; object-fit: cover; }
.card-body { padding: 1rem; text-align: center; }
.card-title { font-weight: 900; font-size: 1.1rem; margin-bottom: 0.25rem; line-height: 1.2; }
.card-sub { font-size: 0.8rem; color: var(--a-color-muted); }
.a-btn { border: 2px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); transition: all 0.1s; }
.a-btn:hover { background: var(--a-color-paper-soft); }
</style>
