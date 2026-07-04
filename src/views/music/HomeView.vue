<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import ArtistDrawer from '@/components/music/ArtistDrawer.vue'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'
import MusicEntityEditorDrawer from '@/components/music/MusicEntityEditorDrawer.vue'
import NestedActionDrawer from '@/components/music/NestedActionDrawer.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicRouteSelection } from '@/composables/useMusicRouteSelection'
import ExploreView from '@/views/music/ExploreView.vue'

const route = useRoute()
const { isMainShifted, openAlbum, closeAlbum, openArtist, closeArtist, openMusicEditor, closeMusicEditor } = useMusicDrawers()
const { applyRouteSelection } = useMusicRouteSelection({
  openAlbum,
  closeAlbum,
  openArtist,
  closeArtist,
  openMusicEditor,
  closeMusicEditor,
})

watch(
  () => [route.query.artist, route.query.album, route.query.editor, route.query.name],
  () => applyRouteSelection(route.query),
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
