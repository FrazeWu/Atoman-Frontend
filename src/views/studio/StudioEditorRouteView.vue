<template>
  <component v-if="editorComponent" :is="editorComponent" @title-change="emit('title-change', $event)" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useRoute } from 'vue-router'

import type { StudioModule } from '@/types'

const emit = defineEmits<{
  'title-change': [title: string]
}>()

const route = useRoute()
const editors: Record<StudioModule, Component> = {
  blog: defineAsyncComponent(() => import('@/views/blog/PostEditorView.vue')),
  podcast: defineAsyncComponent(() => import('@/views/podcast/PodcastEditorView.vue')),
  video: defineAsyncComponent(() => import('@/views/video/VideoEditorView.vue')),
}

const editorComponent = computed(() => editors[route.params.module as StudioModule])
</script>
