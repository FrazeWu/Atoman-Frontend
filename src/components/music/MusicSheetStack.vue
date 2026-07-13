<script setup lang="ts">
import AlbumDrawer from './AlbumDrawer.vue'
import ArtistDrawer from './ArtistDrawer.vue'
import MusicCreationFlowDrawer from './MusicCreationFlowDrawer.vue'
import MusicEntityEditorDrawer from './MusicEntityEditorDrawer.vue'
import MusicMergeDrawer from './MusicMergeDrawer.vue'
import NestedActionDrawer from './NestedActionDrawer.vue'
import PlaylistDrawer from './PlaylistDrawer.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { layers } = useMusicDrawers()
</script>

<template>
  <template v-for="(layer, index) in layers" :key="layer.key">
    <ArtistDrawer v-if="layer.kind === 'artist'" :layer="layer" :layer-index="index" />
    <AlbumDrawer v-else-if="layer.kind === 'album'" :layer="layer" :layer-index="index" />
    <PlaylistDrawer v-else-if="layer.kind === 'playlist'" :layer="layer" :layer-index="index" />
    <MusicMergeDrawer
      v-else-if="layer.kind === 'action' && (layer.payload.action === 'merge_artist' || layer.payload.action === 'merge_album')"
      :layer="layer"
      :layer-index="index"
    />
    <NestedActionDrawer v-else-if="layer.kind === 'action'" :layer="layer" :layer-index="index" />
    <MusicEntityEditorDrawer v-else-if="layer.kind === 'editor'" :layer="layer" :layer-index="index" />
    <MusicCreationFlowDrawer v-else :layer="layer" :layer-index="index" />
  </template>
</template>
