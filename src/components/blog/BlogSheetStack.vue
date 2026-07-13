<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import BlogCollectionSheet from '@/components/blog/BlogCollectionSheet.vue'
import BlogPostSheet from '@/components/blog/BlogPostSheet.vue'
import { useBlogSheets } from '@/composables/useBlogSheets'

const route = useRoute()
const { layers, closeAll } = useBlogSheets()

watch(() => route.path, (path) => {
  if (/^\/posts\/post\/(new|[^/]+\/edit)$/.test(path)) closeAll()
})
</script>

<template>
  <template v-for="(layer, index) in layers" :key="layer.key">
    <BlogCollectionSheet v-if="layer.kind === 'collection'" :layer="layer" :layer-index="index" :stack-size="layers.length" />
    <BlogPostSheet v-else :layer="layer" :layer-index="index" :stack-size="layers.length" />
  </template>
</template>
