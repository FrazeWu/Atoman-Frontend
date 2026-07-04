<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import MusicEntityEditorDrawer from '@/components/music/MusicEntityEditorDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import ExploreView from '@/views/music/ExploreView.vue'

const route = useRoute()
const { isMainShifted, openAlbum, closeAlbum, openArtist, closeArtist, openMusicEditor, closeMusicEditor } = useMusicDrawers()

let lastRouteArtist: string | null = null
let lastRouteAlbum: string | null = null
let lastRouteEditor: string | null = null

function applyRouteSelection() {
  const artist = route.query.artist
  const album = route.query.album
  const editor = route.query.editor
  const name = route.query.name

  if (typeof artist === 'string' && artist) {
    openArtist(artist)
    lastRouteArtist = artist
  } else if (lastRouteArtist !== null) {
    closeArtist()
    lastRouteArtist = null
  }

  if (typeof album === 'string' && album) {
    openAlbum(album)
    lastRouteAlbum = album
  } else if (lastRouteAlbum !== null) {
    closeAlbum()
    lastRouteAlbum = null
  }

  const nextEditorKey = [
    typeof editor === 'string' ? editor : '',
    typeof artist === 'string' ? artist : '',
    typeof album === 'string' ? album : '',
    typeof name === 'string' ? name : '',
  ].join('|')

  if (typeof editor === 'string' && nextEditorKey !== lastRouteEditor) {
    if (editor === 'artist-create') {
      openMusicEditor({
        entity: 'artist',
        mode: 'create',
        seed: typeof name === 'string' && name.trim() ? { name: name.trim() } : undefined,
      })
      lastRouteEditor = nextEditorKey
      return
    }

    if (editor === 'album-edit' && typeof album === 'string' && album) {
      openMusicEditor({
        entity: 'album',
        mode: 'edit',
        id: album,
      })
      lastRouteEditor = nextEditorKey
      return
    }
  }

  if (typeof editor !== 'string' && lastRouteEditor !== null) {
    closeMusicEditor()
    lastRouteEditor = null
  }
}

watch(
  () => [route.query.artist, route.query.album, route.query.editor, route.query.name],
  applyRouteSelection,
  { immediate: true },
)
</script>

<template>
  <div class="music-base-view">
    <div class="main-level-1" :class="{ 'is-shifted': isMainShifted }">
      <ExploreView page-title="专辑" />
    </div>

    <ArtistDrawer />
    <AlbumDrawer />
    <MusicEntityEditorDrawer />
    <NestedActionDrawer />
  </div>
</template>

<style scoped>
.music-base-view {
  position: relative;
}

.main-level-1 {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.main-level-1.is-shifted {
  transform: translateX(-10%) scale(0.98);
  opacity: 0.4;
  pointer-events: none;
}
</style>
