<!-- web/src/components/music/ArtistDrawer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, closeArtist, isArtistShifted, openAlbum, openNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.artistId !== null)

// Placeholder data for design
const dummyAlbums = [
  { id: '1', title: 'The Dark Side of the Moon', year: '1973', tracks: 10 },
  { id: '2', title: 'Wish You Were Here', year: '1975', tracks: 5 },
]
</script>

<template>
  <PaperSheet 
    :show="isOpen" 
    @close="closeArtist" 
    width="900px" 
    :is-shifted="isArtistShifted"
  >
    <template #header>
      <div class="drawer-header-content">
        <div class="kicker">ARTIST ENTRY</div>
        <h2 class="title">Artist {{ state.artistId }}</h2>
      </div>
    </template>

    <div class="drawer-body">
      <div class="actions">
        <button class="a-btn-dashed" @click="openNestedAction('revise_artist')">✍ 修订艺术家信息</button>
        <button class="a-btn-dashed" @click="openNestedAction('add_album')">+ 添加新专辑</button>
      </div>

      <div class="album-list-header">
        <h3>专辑列表</h3>
      </div>

      <div
        v-for="album in dummyAlbums"
        :key="album.id"
        class="album-row"
        @click="openAlbum(album.id)"
      >
        <div class="album-row-left">
          <div class="album-year">{{ album.year }}</div>
        </div>
        <div class="album-row-right">
          <div class="album-row-cover">COVER</div>
          <div class="album-row-info">
            <div class="album-row-title">{{ album.title }}</div>
            <div class="album-row-meta">{{ album.tracks }} Tracks · Studio Album</div>
          </div>
        </div>
      </div>
    </div>
  </PaperSheet>
</template>

<style scoped>
.drawer-header-content { display: flex; flex-direction: column; gap: 0.25rem; }
.kicker { font-family: var(--a-font-meta); font-size: 0.75rem; font-weight: bold; letter-spacing: 0.1em; color: var(--a-color-ink-soft); }
.title { font-family: var(--a-font-serif); font-size: 2.5rem; margin: 0; line-height: 1.1; }

.drawer-body { display: flex; flex-direction: column; }
.actions { display: flex; gap: 1rem; margin-bottom: 2rem; }
.a-btn-dashed { border: 1.5px dashed var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: transparent; cursor: pointer; font-family: var(--a-font-meta); }
.a-btn-dashed:hover { background: var(--a-color-paper-soft); }

.album-list-header { margin-bottom: 2rem; border-bottom: 1px dashed var(--a-color-line-soft); padding-bottom: 1rem; }
.album-list-header h3 { font-size: 1.2rem; font-weight: 900; margin: 0; }
.album-row { display: flex; gap: 2rem; margin-bottom: 2rem; position: relative; cursor: pointer; transition: transform 0.1s; }
.album-row:hover { transform: translateX(4px); }
.album-row-left { width: 100px; flex-shrink: 0; text-align: right; padding-top: 0.5rem; }
.album-year { font-family: var(--a-font-meta); font-size: 1.5rem; font-weight: 900; color: var(--a-color-ink); }
.album-row-right { flex: 1; display: flex; background: var(--a-color-paper); border: 2px solid var(--a-color-ink); padding: 1rem; gap: 1.5rem; }
.album-row-right:hover { box-shadow: 4px 4px 0 0 rgba(0,0,0,0.1); }
.album-row-cover { width: 100px; height: 100px; background: var(--a-color-paper-wash); border: 1px solid var(--a-color-ink); display: flex; align-items: center; justify-content: center; font-family: var(--a-font-meta); font-size: 0.7rem; color: var(--a-color-ink-soft); flex-shrink: 0; }
.album-row-info { display: flex; flex-direction: column; justify-content: center; }
.album-row-title { font-family: var(--a-font-serif); font-size: 1.5rem; font-weight: 900; margin-bottom: 0.25rem; }
.album-row-meta { font-family: var(--a-font-meta); font-size: 0.8rem; color: var(--a-color-ink-soft); }
</style>
