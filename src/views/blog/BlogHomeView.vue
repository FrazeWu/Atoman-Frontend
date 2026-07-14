<template>
  <div class="a-page">
    <BookmarkFolderModal ref="bookmarkModalRef" />
    <PPageHeader title="文章" accent>
      <template #action>
        <PButton v-if="authStore.isAuthenticated && canCreatePost" to="/posts/post/new">+ 写文章</PButton>
        <PButton v-else to="/login" outline>登录</PButton>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import PEntry from '@/components/ui/PEntry.vue'
import PClip from '@/components/ui/PClip.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import BookmarkFolderModal from '@/components/blog/BookmarkFolderModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import type { Post } from '@/types'

const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const feedStore = useFeedStore()
const api = useApi()
const route = useRoute()
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
const typeFilter = ref('all')
const sortBy = ref('latest')
const activeQuery = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')

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
  { label: '推荐', value: 'recommended' },
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
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`

    const isPopular = sortBy.value === 'popular'
    const isRecommended = sortBy.value === 'recommended'
    const query = new URLSearchParams()
    query.set('page', String(page.value))
    query.set('page_size', '20')
    query.set('sort', 'latest')
    if (activeQuery.value) query.set('q', activeQuery.value)
    const endpoint = isPopular || isRecommended
      ? `${api.url}/blog/recommend/posts?mode=${isPopular ? 'hot' : 'featured'}&page=${page.value}&page_size=20`
      : `${api.blog.posts}?${query.toString()}`

    const res = await fetch(endpoint, { headers })
    if (res.ok) {
      const d = await res.json()
      const rawData = d.data || []
      const extractedPosts: Post[] = rawData.map((item: any) => {
        if (isPopular || isRecommended) {
          return {
            id: item.id,
            title: item.title,
            summary: item.summary,
            cover_url: item.image_url,
            likes_count: 0,
            comments_count: 0,
          }
        }
        return item as Post
      }).filter(Boolean)

      if (append) {
        posts.value = [...posts.value, ...extractedPosts]
      } else {
        posts.value = extractedPosts
      }
      hasMore.value = Boolean(d.meta?.has_more)
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

watch(activeQuery, () => {
  if (sortBy.value === 'latest') {
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

.blog-entry-cover {
  width: 4.5rem;
  height: 4.5rem;
  object-fit: cover;
  filter: grayscale(100%);
  border-radius: 8px;
}
</style>
