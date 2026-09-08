<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import BlogPostReader from '@/components/blog/BlogPostReader.vue'
import type { Post } from '@/types'

type ReaderInstance = {
  post: Post | null
  loading: boolean
  errorStatus: number | null
  isAcademic: boolean
  bookmarked: boolean
  postEmbeds: Record<string, unknown>
  musicEmbeds: Record<string, unknown>
  videoEmbeds: Record<string, unknown>
}

const route = useRoute()
const reader = ref<ReaderInstance | null>(null)
const postId = computed(() => String(route.params.id || ''))

// Keep the existing view-level state surface while the reader implementation is shared.
const post = computed(() => reader.value?.post ?? null)
const loading = computed(() => reader.value?.loading ?? true)
const errorStatus = computed(() => reader.value?.errorStatus ?? null)
const isAcademic = computed(() => reader.value?.isAcademic ?? false)
const bookmarked = computed(() => reader.value?.bookmarked ?? false)
const postEmbeds = computed(() => reader.value?.postEmbeds ?? {})
const musicEmbeds = computed(() => reader.value?.musicEmbeds ?? {})
const videoEmbeds = computed(() => reader.value?.videoEmbeds ?? {})

defineExpose({ post, loading, errorStatus, isAcademic, bookmarked, postEmbeds, musicEmbeds, videoEmbeds })
</script>

<template>
  <BlogPostReader ref="reader" :post-id="postId" presentation="page" />
</template>
