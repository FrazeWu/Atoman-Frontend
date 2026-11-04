<script setup lang="ts">
import type { FeedRecommendationTheme } from '@/types'
import { ALL_THEME, type FeedSourceFilterCategory } from '@/composables/feed/useFeedRecommendedHelpers'

defineProps<{
  category: FeedSourceFilterCategory
  theme: string
  categoryOptions: Array<{ label: string; value: FeedSourceFilterCategory }>
  themes: FeedRecommendationTheme[]
}>()

const emit = defineEmits<{
  (e: 'select-category', category: FeedSourceFilterCategory): void
  (e: 'select-theme', themeId: string): void
}>()
</script>

<template>
  <div class="discovery-pills-bar">
    <!-- 基础类型胶囊 -->
    <button
      v-for="cat in categoryOptions"
      :key="cat.value"
      type="button"
      class="topic-pill"
      :class="{ 'is-active': category === cat.value && theme === ALL_THEME }"
      @click="emit('select-category', cat.value)"
    >
      {{ cat.label }}
    </button>

    <!-- 主题标签分隔与动态主题列表 -->
    <template v-if="themes.length">
      <span class="topic-pill-divider" aria-hidden="true">|</span>
      <button
        v-for="t in themes"
        :key="t.id"
        type="button"
        class="topic-pill"
        :class="{ 'is-active': theme === t.id }"
        @click="emit('select-theme', t.id)"
      >
        # {{ t.label }}
      </button>
    </template>
  </div>
</template>
