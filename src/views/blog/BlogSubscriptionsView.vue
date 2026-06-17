<template>
  <div class="a-page">
    <APageHeader :title="moduleRooms.blog.name" sub="查看你关注的创作者与频道更新" accent>
      <template #action>
        <ABtn v-if="authStore.isAuthenticated && canCreatePost" to="/post/new">+ 写文章</ABtn>
        <ABtn v-else-if="!authStore.isAuthenticated" to="/login" outline>登录</ABtn>
      </template>
    </APageHeader>

    <!-- Posts list -->
    <div v-if="loading && !posts.length" class="a-grid-2">
      <div v-for="i in 6" :key="i" class="a-skeleton" style="height:12rem" />
    </div>
    
    <div v-else-if="!authStore.isAuthenticated">
      <AEmpty title="请先登录" description="登录后即可查看你关注的创作者动态" />
    </div>

    <AEmpty 
      v-else-if="!posts.length" 
      title="暂无订阅更新" 
      description="去探索页看看大家都在写什么吧" 
    />
    
    <div v-else>
      <PaperEntry
        v-for="post in posts"
        :key="post.id"
        :title="post.title"
        :summary="post.summary"
        @click="$router.push('/post/' + post.id)"
      >
        <template #visual>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
            <PaperBadge type="internal" fill>内部</PaperBadge>
            <PaperBadge type="blog">博客</PaperBadge>
            <img
              v-if="post.cover_url"
              :src="post.cover_url"
              class="blog-entry-cover"
              style="margin-top:0.25rem"
            />
            <PaperAvatar
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
            <PaperClip
              :active="starredIds.has(post.id)"
              :label="starredIds.has(post.id) ? '退藏' : '收藏'"
              @click="toggleStar(post.id)"
            />
            <PaperClip
              :active="readingListIds.has(post.id)"
              :label="readingListIds.has(post.id) ? '移出队列' : '稍后阅读'"
              @click="toggleReadingList(post.id)"
            />
          </div>
        </template>
      </PaperEntry>
    </div>

    <!-- Load more -->
    <div v-if="hasMore && !loading" style="display:flex;justify-content:center;margin-top:2rem">
      <ABtn outline @click="loadMore">加载更多</ABtn>
    </div>
    <div v-else-if="loading && posts.length" style="display:flex;justify-content:center;margin-top:2rem">
      <p class="a-muted">加载中...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperAvatar from '@/components/ui/PaperAvatar.vue'
import PaperBadge from '@/components/ui/PaperBadge.vue'
import ABtn from '@/components/ui/ABtn.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperTab from '@/components/ui/PaperTab.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { moduleRooms } from '@/config/moduleRooms'
import type { Post, TimelineItem } from '@/types'

// Included components from BlogHomeView as requested, even if not used directly in template
// to maintain consistency and fulfill requirement
const _components = { PaperBadge, PaperTab }

const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const feedStore = useFeedStore()
const api = useApi()

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const canCreatePost = computed(() => siteAccessStore.isFeatureEnabled('blog', 'post.create'))

const posts = ref<Post[]>([])
const loading = ref(true)
const page = ref(1)
const hasMore = ref(false)

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
  border-radius: 4px;
}
</style>
