<script setup lang="ts">
import { defineAsyncComponent, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBlogSheets } from '@/composables/useBlogSheets'

const BlogChannelSheet = defineAsyncComponent(() => import('@/components/blog/BlogChannelSheet.vue'))
const BlogCollectionSheet = defineAsyncComponent(() => import('@/components/blog/BlogCollectionSheet.vue'))
const BlogPostSheet = defineAsyncComponent(() => import('@/components/blog/BlogPostSheet.vue'))
const ShortNoteSheet = defineAsyncComponent(() => import('@/components/blog/ShortNoteSheet.vue'))

const route = useRoute()
const { renderLayers, closeAll } = useBlogSheets()

if (!route.path.startsWith('/posts')) closeAll()

watch(() => route.fullPath, (_, previousFullPath) => {
  const path = route.path
  const previousPath = previousFullPath?.split(/[?#]/, 1)[0] || ''
  const directPostHandoff = path === '/posts'
    && /^\/posts\/post\/[^/]+$/.test(previousPath)
    && renderLayers.value.some(layer => layer.key === `post:${previousPath.split('/').at(-1)}`)

  if (directPostHandoff) return
  closeAll()
})
</script>

<template>
  <template v-for="(layer, index) in renderLayers" :key="layer.key">
    <BlogChannelSheet v-if="layer.kind === 'channel'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <BlogCollectionSheet v-else-if="layer.kind === 'collection'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <ShortNoteSheet v-else-if="layer.kind === 'short_note'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
    <BlogPostSheet v-else-if="layer.kind === 'post'" :layer="layer" :layer-index="index" :stack-size="renderLayers.length" />
  </template>
</template>
