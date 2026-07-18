<template>
  <div class="a-page">
    <PPageHeader title="文章" accent>
      <template #action>
        <PButton v-if="!authStore.isAuthenticated" to="/login" outline>登录</PButton>
      </template>
    </PPageHeader>

    <!-- Filters -->
    <div class="blog-home__filters" aria-label="文章筛选">
      <div class="blog-home__filter-group">
        <PSegmentedControl
          v-model="typeFilter"
          :options="typeOptions"
          @change="selectType"
        />
      </div>
      <div class="blog-home__filter-group blog-home__filter-group--end">
        <PSegmentedControl
          v-model="sortBy"
          :options="sortOptions"
          @change="selectSort"
        />
      </div>
    </div>

    <section class="blog-home__recommendations" aria-label="文章推荐">
      <div class="blog-home__recommendation-header">
        <div>
          <h2 class="blog-home__recommendation-title">推荐</h2>
          <p class="blog-home__recommendation-note">按热度、精选、探索切换当前文章推荐。</p>
        </div>
        <PSegmentedControl
          v-model="recommendationMode"
          :options="recommendationOptions"
          @change="selectRecommendationMode"
        />
      </div>

      <div v-if="recommendationLoading" class="a-grid-2">
        <div v-for="i in 3" :key="i" class="a-skeleton" style="height:10rem" />
      </div>
      <PEmpty v-else-if="!recommendedPosts.length" title="暂无推荐" description="稍后再来看新的文章推荐。" />
      <div v-else class="blog-home__recommendation-list">
        <PEntry
          v-for="item in recommendedPosts"
          :key="item.id"
          :title="item.title"
          :summary="item.summary"
          @click="openRecommendedPost(item)"
        >
          <template #visual>
            <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
              <PBadge type="blog">文章</PBadge>
              <img
                v-if="item.image_url"
                :src="item.image_url"
                class="blog-entry-cover"
                style="margin-top:0.25rem"
              />
            </div>
          </template>

          <template #meta>
            <span>{{ item.score_label }}</span>
          </template>
        </PEntry>
      </div>
    </section>

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
        @click="openPost(post)"
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
            <div style="display:flex;gap:1rem;color:var(--a-color-muted-soft);font-size:0.75rem;font-weight: 500">
              <span>♥ {{ post.likes_count || 0 }}</span>
              <span>💬 {{ post.comments_count || 0 }}</span>
            </div>
            <PClip
              :active="isStarred(post)"
              :label="isStarred(post) ? '取消收藏' : '收藏'"
              @click="toggleStar(post)"
            />
            <PClip
              :active="isReadingList(post)"
              :label="isReadingList(post) ? '取消稍后阅读' : '稍后阅读'"
              @click="toggleReadingList(post)"
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
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PEntry from '@/components/ui/PEntry.vue'
import PClip from '@/components/ui/PClip.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import type { Post } from '@/types'

const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()
const blogSheets = useBlogSheets()
const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 20

type BlogHomeListItem = Post & {
  source: 'post' | 'feed'
  targetPath: string
}

const postStarredIds = computed(() => feedStore.bookmarkedPostIds)
const feedStarredIds = computed(() => feedStore.starredItemIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const isStarred = (item: BlogHomeListItem) => {
  return item.source === 'feed'
    ? feedStarredIds.value.has(item.id)
    : postStarredIds.value.has(item.id)
}

const isReadingList = (item: BlogHomeListItem) => {
  return readingListIds.value.has(item.id)
}

const toggleStar = (item: BlogHomeListItem) => {
  if (item.source === 'feed') {
    void feedStore.toggleStar(item.id)
    return
  }
  void feedStore.togglePostBookmark(item.id)
}

const toggleReadingList = (item: BlogHomeListItem) => {
  void feedStore.toggleReadingListItem(item.id)
}

const openPost = (item: BlogHomeListItem) => {
  if (item.source === 'post') {
    blogSheets.openPost(item.id, item.title)
    return
  }
  void router.push(item.targetPath)
}

const postIdFromTargetPath = (targetPath: string) => {
  const match = targetPath.match(/^\/posts\/post\/([^/?#]+)/)
  return match?.[1]
}

const openRecommendedPost = (item: { id: string; title: string; targetPath: string }) => {
  const postId = postIdFromTargetPath(item.targetPath)
  if (postId) {
    blogSheets.openPost(postId, item.title)
    return
  }
  void router.push(item.targetPath)
}


const posts = ref<BlogHomeListItem[]>([])
const recommendedPosts = ref<Array<{
  id: string
  title: string
  summary: string
  image_url: string
  targetPath: string
  score_label: string
}>>([])
const loading = ref(true)
const recommendationLoading = ref(false)
const page = ref(1)
const hasMore = ref(false)
const typeFilter = ref('all')
const sortBy = ref('latest')
const recommendationMode = ref<'hot' | 'featured' | 'discover'>('hot')
const activeQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')
let postsRequestSequence = 0

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

const recommendationOptions = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

const selectType = (value: string) => {
  typeFilter.value = value
  fetchPosts()
}

const selectSort = (value: string) => {
  sortBy.value = value
  fetchPosts()
}

const selectRecommendationMode = (value: string) => {
  recommendationMode.value = value as 'hot' | 'featured' | 'discover'
  void fetchRecommendedPosts()
}

const fetchRecommendedPosts = async () => {
  recommendationLoading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`

    const res = await fetch(`${api.url}/blog/recommend/posts?mode=${recommendationMode.value}&page=1&page_size=20`, { headers })
    if (!res.ok) return
    const data = await res.json()
    recommendedPosts.value = Array.isArray(data.data)
      ? data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          image_url: item.image_url,
          targetPath: item.target_path,
          score_label: item.score_label,
        }))
      : []
  } catch (error) {
    console.error(error)
    recommendedPosts.value = []
  } finally {
    recommendationLoading.value = false
  }
}

const fetchPosts = async (append = false) => {
  const requestSequence = ++postsRequestSequence
  const targetPage = append ? page.value + 1 : 1
  loading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`

    const isPopular = sortBy.value === 'popular'
    const query = new URLSearchParams()
    query.set('page', String(targetPage))
    query.set('limit', String(PAGE_SIZE))
    if (activeQuery.value) query.set('q', activeQuery.value)
    const endpoint = isPopular
      ? `${api.url}/feed/recommend/articles?mode=hot&page=${targetPage}&page_size=${PAGE_SIZE}`
      : `${api.blog.explore}?${query.toString()}`

    const res = await fetch(endpoint, { headers })
    if (requestSequence !== postsRequestSequence) return false
    if (res.ok) {
      const d = await res.json()
      if (requestSequence !== postsRequestSequence) return false
      const rawData = d.data || []
      const extractedPosts: BlogHomeListItem[] = rawData.map((item: any) => {
        if (isPopular) {
          const targetPath = item.target_path || `/feed/item/${item.id}`
          const targetPostId = postIdFromTargetPath(targetPath)
          const source = targetPostId ? 'post' : 'feed'
          return {
            id: targetPostId || item.id,
            title: item.title,
            summary: item.summary,
            cover_url: item.image_url,
            likes_count: 0,
            comments_count: 0,
            source,
            targetPath,
          }
        }
        const post = item.post || item
        if (post?.id) {
          return {
            ...post,
            source: 'post',
            targetPath: `/posts/post/${post.id}`,
          }
        }
        return null
      }).filter(Boolean)

      if (append) {
        posts.value = [...posts.value, ...extractedPosts]
      } else {
        posts.value = extractedPosts
      }
      hasMore.value = isPopular
        ? Boolean(d.meta?.has_more)
        : typeof d.meta?.has_more === 'boolean' ? d.meta.has_more : rawData.length === PAGE_SIZE
      page.value = targetPage
      return true
    }
  } catch (e) {
    console.error(e)
  } finally {
    if (requestSequence === postsRequestSequence) loading.value = false
  }
  return false
}

const loadMore = () => {
  if (!loading.value && hasMore.value) void fetchPosts(true)
}

onMounted(() => {
  void fetchPosts()
  void fetchRecommendedPosts()
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchStarredIds()
    void feedStore.fetchReadingListIds()
  }
})

onUnmounted(() => {
  postsRequestSequence += 1
})

watch(activeQuery, () => {
  if (sortBy.value !== 'popular') {
    void fetchPosts()
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

.blog-home__recommendations {
  margin-bottom: 2rem;
}

.blog-home__recommendation-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.blog-home__recommendation-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.blog-home__recommendation-note {
  margin: 0.35rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.85rem;
}

.blog-home__recommendation-list {
  display: flex;
  flex-direction: column;
}

.blog-entry-cover {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: cover;
  filter: grayscale(100%);
  border-radius: 4px;
}
</style>
