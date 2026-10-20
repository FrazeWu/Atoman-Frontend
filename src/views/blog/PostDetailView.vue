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
    <Teleport to="body">
      <button
        v-if="isAuthor"
        class="theme-customize-launcher"
        title="装扮空间"
        @click="isThemeDrawerOpen = true"
      >
        <span>🎨</span>
        <span>装扮空间</span>
      </button>
    </Teleport>

    <ThemeCustomizerDrawer
      v-if="isAuthor && authorId"
      v-model:open="isThemeDrawerOpen"
      :creator-id="authorId"
      :creator-handle="authorHandle"
      :initial-theme="activeTheme"
    />

    <ThemeEscapeHatch v-if="!isAuthor" />
  </CreatorThemeScope>
</template>

<style scoped>
.theme-customize-launcher {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: var(--a-layer-normal-sheet-panel, 310);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background-color: var(--a-color-surface);
  color: var(--a-color-text);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  outline: none;
}

.theme-customize-launcher:hover {
  transform: scale(1.05);
  background-color: var(--a-color-surface-muted);
  border-color: var(--a-color-border);
}

.theme-customize-launcher:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}
</style>
