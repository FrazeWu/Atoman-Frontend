<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useBlogSheets } from '@/composables/useBlogSheets'
import { isStandaloneMobileApp } from '@/utils/appRuntime'
import PostDetailView from '@/views/blog/PostDetailView.vue'

const route = useRoute()
const router = useRouter()
const sheets = useBlogSheets()
const postId = computed(() => String(route.params.id || ''))
const isMobile = isStandaloneMobileApp()

onMounted(() => {
  if (isMobile || !postId.value) return
  sheets.openPost(postId.value, '文章')
  void router.replace({ path: '/posts', query: route.query })
})
</script>

<template>
  <PostDetailView v-if="isMobile" :id="postId" />
</template>
