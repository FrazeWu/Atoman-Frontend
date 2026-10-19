<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import BlogPostReader from '@/components/blog/BlogPostReader.vue'
import ThemeCustomizerDrawer from '@/components/theme/ThemeCustomizerDrawer.vue'
import CreatorThemeScope from '@/components/theme/CreatorThemeScope.vue'
import ThemeEscapeHatch from '@/components/theme/ThemeEscapeHatch.vue'
import { useAuthStore } from '@/stores/auth'
import { useCreatorTheme } from '@/composables/useCreatorTheme'
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
const authStore = useAuthStore()
const { activeTheme, loadCreatorTheme, clearTheme } = useCreatorTheme()

const reader = ref<ReaderInstance | null>(null)
const postId = computed(() => String(route.params.id || ''))
const isThemeDrawerOpen = ref(false)

// Keep the existing view-level state surface while the reader implementation is shared.
const post = computed(() => reader.value?.post ?? null)
const loading = computed(() => reader.value?.loading ?? true)
const errorStatus = computed(() => reader.value?.errorStatus ?? null)
const isAcademic = computed(() => reader.value?.isAcademic ?? false)
const bookmarked = computed(() => reader.value?.bookmarked ?? false)
const postEmbeds = computed(() => reader.value?.postEmbeds ?? {})
const musicEmbeds = computed(() => reader.value?.musicEmbeds ?? {})
const videoEmbeds = computed(() => reader.value?.videoEmbeds ?? {})

const authorHandle = computed(() => post.value?.user?.username || '')
const authorId = computed(() => post.value?.user?.uuid || post.value?.user_id || '')
const isAuthor = computed(() => {
  if (!post.value || !authStore.user) return false
  return Boolean(
    (post.value.user_id && post.value.user_id === authStore.user.uuid) ||
    (post.value.user?.uuid && post.value.user?.uuid === authStore.user.uuid) ||
    (post.value.user?.username && post.value.user?.username === authStore.user.username)
  )
})

watch(() => post.value?.user?.username, (handle) => {
  if (handle) {
    void loadCreatorTheme(handle).catch(() => {})
  }
}, { immediate: true })

onUnmounted(() => {
  clearTheme()
})

defineExpose({ post, loading, errorStatus, isAcademic, bookmarked, postEmbeds, musicEmbeds, videoEmbeds })
</script>

<template>
  <CreatorThemeScope :creator-id="authorId" :preset-config="activeTheme?.preset_config">
    <BlogPostReader ref="reader" :post-id="postId" presentation="page" />

    <!-- 创作者装扮入口与定制抽屉 -->
    <button
      v-if="isAuthor"
      class="theme-customize-launcher fixed bottom-6 right-6 z-[600] flex items-center gap-1.5 px-3 py-2 bg-surface text-text border border-border shadow-lg rounded-full text-xs font-medium hover:bg-surface-soft transition-transform hover:scale-105 cursor-pointer"
      title="装扮空间"
      @click="isThemeDrawerOpen = true"
    >
      <span>🎨</span>
      <span>装扮空间</span>
    </button>

    <ThemeCustomizerDrawer
      v-if="isAuthor && authorId"
      v-model:open="isThemeDrawerOpen"
      :creator-id="authorId"
      :creator-handle="authorHandle"
      :initial-theme="activeTheme"
    />

    <ThemeEscapeHatch />
  </CreatorThemeScope>
</template>
