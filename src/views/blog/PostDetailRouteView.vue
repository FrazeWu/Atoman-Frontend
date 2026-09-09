<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useBlogSheets } from '@/composables/useBlogSheets'
import { isStandaloneMobileApp } from '@/utils/appRuntime'
import PostDetailView from '@/views/blog/PostDetailView.vue'

const route = useRoute()
const router = useRouter()
const sheets = useBlogSheets()
const postId = computed(() => String(route.params.id || ''))
const isMobile = isStandaloneMobileApp()

const layerKey = computed(() => `post:${postId.value}`)

const openPost = () => {
  if (isMobile || !postId.value || sheets.isActive(layerKey.value)) return
  sheets.openPost(postId.value, '文章')
}

onMounted(openPost)
watch(postId, openPost)
watch(
  () => sheets.isActive(layerKey.value),
  (active) => {
    if (isMobile || active || !route.path.startsWith('/posts/post/')) return
    void router.replace({ path: '/posts', query: route.query })
  },
)
</script>

<template>
  <PostDetailView v-if="isMobile" :id="postId" />
</template>
