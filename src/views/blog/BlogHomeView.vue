<template>
  <div class="a-page">
    <PPageHeader title="文章" sub="查看当前频道下的文章内容。" accent>
      <template #action>
        <PButton v-if="authStore.isAuthenticated && canCreatePost" to="/post/new">+ 写文章</PButton>
        <PButton v-else to="/login" outline>登录</PButton>
      </template>
    </PPageHeader>

    <!-- Filters -->
    <div class="blog-home__filters" aria-label="文章筛选">
      <div class="blog-home__filter-group">
        <PTab
          v-for="t in typeOptions"
          :key="t.value"
          :label="t.label"
          :active="typeFilter === t.value"
          @click="selectType(t.value)"
        />
      </div>
      <div class="blog-home__filter-group blog-home__filter-group--end">
        <PTab
          v-for="s in sortOptions"
          :key="s.value"
          :label="s.label"
          :active="sortBy === s.value"
          @click="selectSort(s.value)"
        />
      </div>
    </div>

    <!-- Posts list -->
    <div v-if="loading" class="a-grid-2">
      <div v-for="i in 6" :key="i" class="a-skeleton" style="height:12rem" />
    </div>
    <PEmpty v-else-if="!posts.length" title="暂无内容" description="还没有发布任何内容" />
    <div v-else>
      <PEntry
        v-for="post in posts"
        :key="post.id"
        :title="post.title"
        :summary="post.summary"
        @click="$router.push('/post/' + post.id)"
      >
        <template #visual>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
            <PBadge type="internal" fill>内部</PBadge>
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
              :label="starredIds.has(post.id) ? '退藏' : '收藏'"
              @click="toggleStar(post.id)"
            />
            <PClip
              :active="readingListIds.has(post.id)"
              :label="readingListIds.has(post.id) ? '移出队列' : '稍后阅读'"
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import PEntry from '@/components/ui/PEntry.vue'
import PClip from '@/components/ui/PClip.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTab from '@/components/ui/PTab.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useFeedStore } from '@/stores/feed'
import { useApi, useApiUrl } from '@/composables/useApi'
import type { Post } from '@/types'

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
const API_URL = useApiUrl()

const posts = ref<Post[]>([])
const loading = ref(true)
const page = ref(1)
const hasMore = ref(false)
const typeFilter = ref('all')
const sortBy = ref('latest')

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const typeOptions = [
  { label: '全部', value: 'all' },
  { label: '文章', value: 'post' },
]

const sortOptions = [
  { label: '最新', value: 'latest' },
  { label: '最热', value: 'popular' },
]

const selectType = (value: string) => {
  typeFilter.value = value
  fetchPosts()
}

const selectSort = (value: string) => {
  sortBy.value = value
  fetchPosts()
}

const fetchPosts = async (append = false) => {
  loading.value = true
  if (!append) page.value = 1
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: '12',
    })
    
    // Use explore endpoint for site-wide recommendations
    const endpoint = sortBy.value === 'popular' ? api.blog.explore : `${API_URL}/feed/explore/timeline`
    // /feed/explore/timeline returns { type, post, feed_item }

    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`

    const res = await fetch(`${endpoint}?${params}`, { headers })
    if (res.ok) {
      const d = await res.json()
      // /feed/explore returns { type, post, feed_item }
      // api.blog.explore returns { post, likes_count, comments_count }
      const rawData = d.data || []
      const extractedPosts: Post[] = rawData.map((item: any) => {
        if (item.type === 'post') return item.post
        if (item.post) return item.post // for api.blog.explore
        return null
      }).filter(Boolean)

      if (append) {
        posts.value = [...posts.value, ...extractedPosts]
      } else {
        posts.value = extractedPosts
      }
      hasMore.value = rawData.length === 12
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  page.value++
  fetchPosts(true)
}

onMounted(() => {
  void fetchPosts()
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
})
</script>

<style scoped>
.blog-home__filters {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.blog-home__filter-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.blog-home__filter-group--end {
  margin-left: auto;
}

.blog-entry-cover {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: cover;
  filter: grayscale(100%);
  border-radius: 4px;
}
</style>
