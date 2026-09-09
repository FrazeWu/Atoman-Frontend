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
      <SubscriptionInboxToolbar
        :unread-only="unreadOnly"
        :marking-all-read="markingAllRead"
        :refreshing="loading"
        :last-synced-at="lastSyncedAt"
        @toggle-unread="toggleUnread"
        @refresh="refresh"
        @mark-all-read="markAllRead"
      />
      <div v-if="loading && !subscriptionItems.length" class="a-grid-2">
        <div v-for="index in 6" :key="index" class="a-skeleton" style="height:12rem" />
      </div>

      <PEmpty v-else-if="loadError && !subscriptionItems.length" title="订阅内容加载失败">
        <template #action>
          <PButton variant="secondary" size="sm" @click="retry">重试</PButton>
        </template>
      </PEmpty>

      <PEmpty v-else-if="!subscriptionItems.length" title="暂无更新" />

      <div v-else>
        <p v-if="loadError" class="a-error" role="alert">{{ loadError }}</p>
        <template v-for="(item, index) in subscriptionItems" :key="item.post?.id || item.short_note?.id">
          <BlogItemCard
            v-if="item.type === 'post' && item.post"
            :item="item.post"
            type="post"
            :is-read="item.is_read"
            :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
            :bookmarked="starredIds.has(item.post.id)"
            :in-reading-list="readingListIds.has(item.post.id)"
            @click="blogSheets.openPost(item.post.id, item.post.title)"
            @toggle-bookmark="toggleStar(item.post.id)"
            @toggle-reading-list="toggleReadingList(item.post.id)"
          />
          <ShortNoteCard
            v-else-if="item.type === 'short_note' && item.short_note"
            :note="item.short_note"
            :is-read="item.is_read"
            @mark-read="markShortNoteRead(item)"
          />
        </template>
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
import SubscriptionInboxToolbar from '@/components/feed/SubscriptionInboxToolbar.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import ShortNoteCard from '@/components/shortnote/ShortNoteCard.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { useModuleSubscriptionTimeline } from '@/composables/feed/useModuleSubscriptionTimeline'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import type { Post, TimelineItem } from '@/types'

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
const subscriptionItems = computed(() => timeline.items.value.filter((item) =>
  (item.type === 'post' && item.post) || (item.type === 'short_note' && item.short_note),
))
const loading = timeline.loading
const loadError = timeline.error
const hasMore = timeline.hasMore
const unreadOnly = timeline.unreadOnly
const markingAllRead = timeline.markingAllRead
const lastSyncedAt = timeline.lastSyncedAt
const retry = () => { void timeline.retry() }
const loadMore = () => { void timeline.loadMore() }
const toggleUnread = () => { timeline.toggleUnread() }
const refresh = () => { void timeline.refresh() }
const markAllRead = () => { void timeline.markAllRead() }

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const markShortNoteRead = (item: TimelineItem) => {
  if (item.type !== 'short_note' || !item.short_note || item.is_read) return
  void (async () => {
    const success = await feedStore.markItemsRead([], [item.short_note!.id])
    if (!success) return
    item.is_read = true
    await feedStore.fetchSubscriptions()
  })()
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
