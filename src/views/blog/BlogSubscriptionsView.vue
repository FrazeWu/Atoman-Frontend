<template>
  <div class="a-page-xl blog-subscriptions-page">
    <BookmarkFolderModal ref="bookmarkModalRef" />
    <PPageHeader title="订阅" accent>
      <template #action>
        <PButton v-if="authStore.isAuthenticated && canCreatePost" to="/posts/post/new">+ 写文章</PButton>
        <PButton v-else-if="!authStore.isAuthenticated" to="/login" outline>登录</PButton>
      </template>
    </PPageHeader>

    <!-- Posts list -->
    <div v-if="loading && !posts.length" class="a-grid-2">
      <div v-for="i in 6" :key="i" class="a-skeleton" style="height:12rem" />
    </div>

    <div v-else-if="!authStore.isAuthenticated">
      <PEmpty title="请先登录" description="登录后查看订阅内容" />
    </div>

    <PEmpty
      v-else-if="!posts.length"
      title="暂无更新"
    />

    <div v-else>
      <PEntry
        v-for="(post, index) in posts"
        :key="post.id"
        :title="post.title"
        :summary="post.summary"
        :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
        @click="router.push('/posts/post/' + post.id)"
      >
        <template #visual>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
            <PBadge type="blog">文章</PBadge>
            <img
              v-if="post.cover_url"
              :src="post.cover_url"
              class="blog-entry-cover"
              style="margin-top:0.25rem"
            />
            <PAvatar
              v-else
              :src="post.user?.avatar_url"
              :name="post.user?.display_name || post.user?.username"
              size="sm"
              style="margin-top:0.25rem"
            />
          </div>
        </template>

        <template #meta>
          <span>《{{ post.channel?.name || '未分类' }}》</span>
          <span>{{ post.user?.display_name || post.user?.username }}</span>
          <span>{{ formatDate(post.created_at) }}</span>
        </template>

        <template #actions>
          <div style="display:flex;gap:1.5rem;align-items:center;width:100%">
            <div style="display:flex;gap:1rem;color:var(--a-color-muted-soft);font-size:0.75rem;font-weight:700">
              <span>♥ {{ post.likes_count || 0 }}</span>
              <span>💬 {{ post.comments_count || 0 }}</span>
            </div>
            <PClip
              :active="starredIds.has(post.id)"
              :label="starredIds.has(post.id) ? '取消收藏' : '收藏'"
              @click="toggleStar(post.id)"
            />
            <PClip
              :active="readingListIds.has(post.id)"
              :label="readingListIds.has(post.id) ? '取消稍后阅读' : '稍后阅读'"
              @click="toggleReadingList(post.id)"
            />
          </div>
        </template>
      </PEntry>
    </div>

    <!-- Load more -->
    <div v-if="hasMore && !loading" style="display:flex;justify-content:center;margin-top:2rem">
      <PButton outline @click="loadMore">加载更多</PButton>
    </div>
    <div v-else-if="loading && posts.length" style="display:flex;justify-content:center;margin-top:2rem">
      <p class="a-muted">加载中...</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PEntry from '@/components/ui/PEntry.vue'
import PClip from '@/components/ui/PClip.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTab from '@/components/ui/PTab.vue'
import BookmarkFolderModal from '@/components/blog/BookmarkFolderModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import { useApi } from '@/composables/useApi'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { moduleRooms } from '@/config/moduleRooms'
import type { Post, TimelineItem } from '@/types'

// Included components from BlogHomeView as requested, even if not used directly in template
// to maintain consistency and fulfill requirement
const _components = { PBadge, PTab }

const router = useRouter()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const feedStore = useFeedStore()
const uiStore = useUIStore()
const api = useApi()
const bookmarkModalRef = ref<InstanceType<typeof BookmarkFolderModal> | null>(null)

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => {
  void bookmarkModalRef.value?.open(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id, 'post')
}

const canCreatePost = computed(() => siteAccessStore.isFeatureEnabled('blog', 'post.create'))

const posts = ref<Post[]>([])
const loading = ref(true)
const page = ref(1)
const hasMore = ref(false)

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items: posts,
  section: 'content',
  onEnter: (post) => {
    router.push('/posts/post/' + post.id)
  },
  onAction: (key, post) => {
    switch (key) {
      case 's': toggleStar(post.id); break
      case 'l': toggleReadingList(post.id); break
    }
  },
})

// Auto-focus first item when switching to content area
watch(() => uiStore.focusedSection, (section) => {
  if (section === 'content' && focusedIndex.value === -1 && posts.value.length > 0) {
    focusedIndex.value = 0
    scrollToFocused()
  }
})

// Reset focus when posts change
watch(posts, () => {
  if (focusedIndex.value >= posts.value.length) {
    focusedIndex.value = posts.value.length > 0 ? 0 : -1
  }
})

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const fetchTimeline = async (append = false) => {
  if (!authStore.isAuthenticated) {
    loading.value = false
    return
  }

  loading.value = true
  if (!append) page.value = 1
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: '12',
    })

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authStore.token}`
    }

    const res = await fetch(`${api.feed.timeline}?${params}`, { headers })
    if (res.ok) {
      const d = await res.json()
      // timeline returns list of items with { type, post, rss_item, ... }
      const rawData: TimelineItem[] = d.data || []
      const extractedPosts: Post[] = rawData
        .filter((item) => item.type === 'post' && item.post)
        .map((item) => item.post as Post)

      if (append) {
        posts.value = [...posts.value, ...extractedPosts]
      } else {
        posts.value = extractedPosts
      }
      hasMore.value = rawData.length === 12
    }
  } catch (e) {
    console.error('Failed to fetch timeline:', e)
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  page.value++
  fetchTimeline(true)
}

onMounted(() => {
  void fetchTimeline()
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
})
</script>

<style scoped>
.blog-entry-cover {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: cover;
  filter: grayscale(100%);
  border-radius: 8px;
}
</style>
