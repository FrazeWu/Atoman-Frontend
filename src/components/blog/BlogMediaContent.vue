<script setup lang="ts">
import { h, onBeforeUnmount, onMounted, ref, render, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import type { EmbedData } from '@/composables/useMarkdownRenderer'
import BlogMediaEmbed from './BlogMediaEmbed.vue'

const props = defineProps<{
  html: string
  musicEmbeds: Record<string, EmbedData>
  videoEmbeds: Record<string, EmbedData>
}>()

const contentElement = ref<HTMLElement | null>(null)
const mountedVideoNodes = new Set<HTMLElement>()
const player = usePlayerStore()

function unmountVideoEmbeds() {
  for (const node of mountedVideoNodes) render(null, node)
  mountedVideoNodes.clear()
}

function syncContent() {
  const element = contentElement.value
  if (!element) return

  unmountVideoEmbeds()
  element.innerHTML = props.html
  element.querySelectorAll<HTMLElement>('[data-atoman-video-embed]').forEach((node) => {
    const id = node.dataset.atomanVideoEmbed
    const embed = id ? props.videoEmbeds[id] : undefined
    if (!embed) return
    render(h(BlogMediaEmbed, { embed }), node)
    mountedVideoNodes.add(node)
  })
}

function playMusicEmbed(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest<HTMLButtonElement>('[data-atoman-embed-play="music"]')
  if (!button) return

  const id = button.dataset.atomanEmbedId
  const embed = id ? props.musicEmbeds[id] : undefined
  const songs = embed?.playbackSongs || []
  if (!embed || !songs.length) return

  event.preventDefault()
  event.stopPropagation()
  if (embed.kind === 'song') player.playSong(songs[0])
  else player.playAlbum(songs)
}

watch(() => [props.html, props.videoEmbeds], syncContent, { deep: true })

onMounted(syncContent)
onBeforeUnmount(unmountVideoEmbeds)
</script>

<template>
  <div ref="contentElement" @click="playMusicEmbed" />
</template>
