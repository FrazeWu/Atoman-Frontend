<script setup lang="ts">
import AlbumDrawer from './AlbumDrawer.vue'
import ArtistDrawer from './ArtistDrawer.vue'
import MusicCreationFlowDrawer from './MusicCreationFlowDrawer.vue'
import MusicEntityEditorDrawer from './MusicEntityEditorDrawer.vue'
import MusicMergeDrawer from './MusicMergeDrawer.vue'
import NestedActionDrawer from './NestedActionDrawer.vue'
import PlaylistDrawer from './PlaylistDrawer.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { renderLayers } = useMusicDrawers()
</script>

<template>
  <template v-for="(layer, index) in renderLayers" :key="layer.key">
    <ArtistDrawer v-if="layer.kind === 'artist'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <AlbumDrawer v-else-if="layer.kind === 'album'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <PlaylistDrawer v-else-if="layer.kind === 'playlist'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <MusicMergeDrawer
      v-else-if="layer.kind === 'action' && (layer.payload.action === 'merge_artist' || layer.payload.action === 'merge_album')"
      :layer="layer"
      :layer-index="index"
      :stack-size="renderLayers.length"
    />
    <NestedActionDrawer v-else-if="layer.kind === 'action'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <MusicEntityEditorDrawer v-else-if="layer.kind === 'editor'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <MusicCreationFlowDrawer v-else :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
  </template>
</template>
