<template>
  <div class="a-page-xl blog-subscriptions-page">
    <ModuleSubscriptionSourcesPicker subscription-type="blog" subscription-path="/posts/subscriptions" />
    <PPageHeader title="订阅" accent>
      <template #action>
        <PButton v-if="!authStore.isAuthenticated" to="/login" outline>登录</PButton>
      </template>
    </PPageHeader>

    <PEmpty v-if="!authStore.isAuthenticated" title="请先登录" description="登录后查看订阅内容" />

    <section v-else class="subscription-posts">
      <div v-if="loading && !posts.length" class="a-grid-2">
        <div v-for="index in 6" :key="index" class="a-skeleton" style="height:12rem" />
      </div>

      <PEmpty v-else-if="loadError && !posts.length" title="订阅内容加载失败">
        <template #action>
          <PButton variant="secondary" size="sm" @click="retry">重试</PButton>
        </template>
      </PEmpty>

      <PEmpty v-else-if="!posts.length" title="暂无更新" />

      <div v-else>
        <p v-if="loadError" class="a-error" role="alert">{{ loadError }}</p>
        <BlogItemCard
          v-for="(post, index) in posts"
          :key="post.id"
          :item="post"
          type="post"
          :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
          :bookmarked="starredIds.has(post.id)"
          :in-reading-list="readingListIds.has(post.id)"
          @click="blogSheets.openPost(post.id, post.title)"
          @toggle-bookmark="toggleStar(post.id)"
          @toggle-reading-list="toggleReadingList(post.id)"
        />
      </div>

      <div v-if="hasMore && !loading" class="subscription-load-more">
        <PButton outline @click="loadMore">加载更多</PButton>
      </div>
      <p v-else-if="loading && posts.length" class="subscription-loading a-muted">加载中...</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'

import ModuleSubscriptionSourcesPicker from '@/components/feed/ModuleSubscriptionSourcesPicker.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { useModuleSubscriptionTimeline } from '@/composables/feed/useModuleSubscriptionTimeline'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import type { Post } from '@/types'

const blogSheets = useBlogSheets()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const uiStore = useUIStore()
const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)
const timeline = useModuleSubscriptionTimeline('blog', 12)
const posts = computed(() => timeline.items.value
  .filter((item) => item.type === 'post' && item.post)
  .map((item) => item.post as Post))
const loading = timeline.loading
const loadError = timeline.error
const hasMore = timeline.hasMore
const retry = () => { void timeline.retry() }
const loadMore = () => { void timeline.loadMore() }

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items: posts,
  section: 'content',
  onEnter: (post) => blogSheets.openPost(post.id, post.title),
  onAction: (key, post) => {
    if (key === 's') toggleStar(post.id)
    if (key === 'l') toggleReadingList(post.id)
  },
})

watch(() => uiStore.focusedSection, (section) => {
  if (section === 'content' && focusedIndex.value === -1 && posts.value.length > 0) {
    focusedIndex.value = 0
    scrollToFocused()
  }
})

watch(posts, () => {
  if (focusedIndex.value >= posts.value.length) {
    focusedIndex.value = posts.value.length > 0 ? 0 : -1
  }
})

onMounted(() => {
  if (!authStore.isAuthenticated) return
  void feedStore.fetchBookmarkedPostIds()
  void feedStore.fetchReadingListIds()
})
</script>

<style scoped>
.subscription-posts {
  min-width: 0;
}

.subscription-load-more {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

.subscription-loading {
  margin: 2rem 0 0;
  text-align: center;
}
</style>
