<template>
  <section class="mobile-saved-page" :data-page="page">
    <header class="mobile-saved-heading">
      <p class="mobile-saved-heading__eyebrow">我的内容</p>
      <h1>{{ currentPage.title }}</h1>
      <p>{{ currentPage.description }}</p>
    </header>
    <component :is="currentPage.component" />
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

defineOptions({ name: 'MobileSavedView' })

const pages = {
  'feed-starred': { title: '文章收藏', description: '把值得重读的文章，留在这里。', component: defineAsyncComponent(() => import('@/views/feed/FeedStarredView.vue')) },
  'feed-reading': { title: '稍后阅读', description: '为好内容留一点时间。', component: defineAsyncComponent(() => import('@/views/feed/FeedReadingListView.vue')) },
  'music-library': { title: '音乐收藏', description: '喜欢的声音，随时再听。', component: defineAsyncComponent(() => import('@/views/music/LibraryView.vue')) },
  'music-history': { title: '播放历史', description: '沿着收听足迹，找回那首歌。', component: defineAsyncComponent(() => import('@/views/music/HistoryView.vue')) },
  'blog-bookmarks': { title: '博客收藏', description: '收藏观点，也收藏灵感。', component: defineAsyncComponent(() => import('@/views/blog/BookmarkView.vue')) },
  'video-favorites': { title: '视频收藏', description: '喜欢的频道，想看的故事。', component: defineAsyncComponent(() => import('@/views/video/VideoFavoritesView.vue')) },
}

const props = defineProps<{ page: keyof typeof pages }>()
const currentPage = computed(() => pages[props.page])
</script>
