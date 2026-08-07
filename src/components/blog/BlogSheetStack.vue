<script setup lang="ts">
import { defineAsyncComponent, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBlogSheets } from '@/composables/useBlogSheets'

const BlogCollectionSheet = defineAsyncComponent(() => import('@/components/blog/BlogCollectionSheet.vue'))
const BlogPostSheet = defineAsyncComponent(() => import('@/components/blog/BlogPostSheet.vue'))
const ShortNoteSheet = defineAsyncComponent(() => import('@/components/blog/ShortNoteSheet.vue'))

const route = useRoute()
const { layers, closeAll } = useBlogSheets()

watch(() => route.path, (path) => {
  if (/^\/posts\/post\/(new|[^/]+\/edit)$/.test(path) || /^\/posts\/notes\/(new|[^/]+\/edit)$/.test(path)) closeAll()
})
</script>

<template>
  <template v-for="(layer, index) in layers" :key="layer.key">
    <BlogCollectionSheet v-if="layer.kind === 'collection'" :layer="layer" :layer-index="index" :stack-size="layers.length" />
    <ShortNoteSheet v-else-if="layer.kind === 'short_note'" :layer="layer" :layer-index="index" :stack-size="layers.length" />
    <BlogPostSheet v-else :layer="layer" :layer-index="index" :stack-size="layers.length" />
  </template>
</template>
