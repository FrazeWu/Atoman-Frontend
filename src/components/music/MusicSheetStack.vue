<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { usePlayerPresentationLease } from '@/composables/music/usePlayerPresentation'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { renderLayers } = useMusicDrawers()
usePlayerPresentationLease(()=>renderLayers.value.some(layer=>layer.kind==='action'&&['merge_artist','merge_album','link_album'].includes(layer.payload.action))?'background':'topbar',()=>renderLayers.value.some(layer=>['creation','editor','action'].includes(layer.kind)),true)
const AlbumDrawer = defineAsyncComponent(() => import('./AlbumDrawer.vue'))
const ArtistDrawer = defineAsyncComponent(() => import('./ArtistDrawer.vue'))
const MusicCreationFlowDrawer = defineAsyncComponent(() => import('./MusicCreationFlowDrawer.vue'))
const MusicEntityEditorDrawer = defineAsyncComponent(() => import('./MusicEntityEditorDrawer.vue'))
const MusicMergeDrawer = defineAsyncComponent(() => import('./MusicMergeDrawer.vue'))
const MusicAlbumCreditLinkDrawer = defineAsyncComponent(() => import('./MusicAlbumCreditLinkDrawer.vue'))
const NestedActionDrawer = defineAsyncComponent(() => import('./NestedActionDrawer.vue'))
const PlaylistDrawer = defineAsyncComponent(() => import('./PlaylistDrawer.vue'))
const SongDrawer = defineAsyncComponent(() => import('./SongDrawer.vue'))
</script>

<template>
  <template v-for="(layer, index) in renderLayers" :key="layer.key">
    <ArtistDrawer v-if="layer.kind === 'artist'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <AlbumDrawer v-else-if="layer.kind === 'album'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <PlaylistDrawer v-else-if="layer.kind === 'playlist'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <SongDrawer v-else-if="layer.kind === 'song'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <MusicMergeDrawer
      v-else-if="layer.kind === 'action' && (layer.payload.action === 'merge_artist' || layer.payload.action === 'merge_album')"
      :layer="layer"
      :layer-index="index"
      :stack-size="renderLayers.length"
    />
	<MusicAlbumCreditLinkDrawer
		v-else-if="layer.kind === 'action' && layer.payload.action === 'link_album'"
		:layer="layer"
		:layer-index="index"
		:stack-size="renderLayers.length"
	/>
    <NestedActionDrawer v-else-if="layer.kind === 'action'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <MusicEntityEditorDrawer v-else-if="layer.kind === 'editor'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <MusicCreationFlowDrawer v-else :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
  </template>
</template>
