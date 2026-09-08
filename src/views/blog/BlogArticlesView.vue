<template>
  <div class="a-page blog-articles">
    <PPageHeader title="博文" sub="搜索和浏览公开发布的文章" accent />

    <form class="blog-articles__filters" aria-label="博文筛选" @submit.prevent="submitSearch">
      <PInput
        v-model="searchInput"
        placeholder="搜索标题或摘要"
        aria-label="搜索博文"
      />
      <PSelect
        v-model="authorId"
        label="作者"
        :options="authorOptions"
        @update:model-value="changeAuthor"
      />
      <PSegmentedControl
        v-model="sort"
        :options="sortOptions"
        @change="changeSort"
      />
      <PSelect
        v-model="channelId"
        label="频道"
        :options="channelOptions"
        @update:model-value="changeChannel"
      />
      <PSelect
        v-model="collectionId"
        label="合集"
        :options="collectionOptions"
        :disabled="collectionsLoading || !channelId"
        @update:model-value="changeCollection"
      />
      <PButton type="submit" label="搜索" />
    </form>

    <div v-if="currentTag" class="blog-articles__active-filter" role="status">
      标签：{{ currentTag }}
      <PButton size="sm" variant="ghost" label="清除标签" @click="clearTag" />
    </div>

    <div class="blog-articles__layout">
      <main class="blog-articles__stream">
        <div v-if="loading && !posts.length" class="blog-articles__skeletons" aria-label="正在加载博文">
          <div v-for="index in 5" :key="index" class="a-skeleton" style="height: 8rem" />
        </div>

        <PEmpty
          v-else-if="error && !posts.length"
          title="博文加载失败"
          description="请稍后重试"
        >
          <template #action>
            <PButton variant="secondary" label="重试" @click="() => void fetchPosts()" />
          </template>
        </PEmpty>

        <template v-else>
          <div v-if="sortedPosts.length" class="blog-articles__list">
            <BlogItemCard
              v-for="post in sortedPosts"
              :key="post.id"
              :item="post"
              type="post"
              @click="openPost(post)"
            />
          </div>
          <PEmpty
            v-else-if="!loading"
            title="暂无博文"
            description="换个关键词或频道试试"
          />
          <p v-if="error && posts.length" class="a-error" role="alert">博文加载失败，请稍后重试</p>
          <PButton
            v-if="hasMore"
            block
            outline
            :loading="loading"
            style="margin-top: 1rem"
            @click="loadMore"
          >加载更多</PButton>
        </template>
      </main>

      <aside class="blog-articles__rail" aria-label="博文导航">
        <section v-if="channels.length" class="blog-articles__rail-section">
          <h2>热门频道</h2>
          <div class="blog-articles__channel-list">
            <button
              v-for="channel in channels.slice(0, 6)"
              :key="channel.id"
              type="button"
              class="blog-articles__channel"
              @click="selectChannel(channel.id)"
            >{{ channel.name }}</button>
          </div>
        </section>
        <section v-if="popularTags.length" class="blog-articles__rail-section">
          <h2>标签</h2>
          <div class="blog-articles__tag-list">
            <button
              v-for="tag in popularTags"
              :key="tag"
              type="button"
              class="blog-articles__tag"
              @click="searchTag(tag)"
            >{{ tag }}</button>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { apiRequestResult } from '@/api/client'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import type { Post } from '@/types'
import { reportError } from '@/utils/logger'

defineOptions({ name: 'BlogArticlesView' })

interface BlogChannel {
  id: string | number
  name: string
  user?: {
    uuid?: string
    username?: string
    display_name?: string
  }
}

interface BlogCollection {
  id: string | number
  name: string
}

interface BlogSearchResult {
  id: string
  title: string
  summary?: string
  snippet?: string
  cover_url?: string
  published_at?: string
  created_at: string
  channel?: BlogChannel
  user?: {
    uuid?: string
    username?: string
    display_name?: string
    avatar_url?: string
  }
}

const PAGE_SIZE = 20
const route = useRoute()
const router = useRouter()
const api = useApi()
const blogSheets = useBlogSheets()
const posts = ref<Post[]>([])
const channels = ref<BlogChannel[]>([])
const collections = ref<BlogCollection[]>([])
const collectionsLoading = ref(false)
const loading = ref(true)
const error = ref(false)
const page = ref(1)
const hasMore = ref(false)
const searchInput = ref('')
const authorId = ref('')
const channelId = ref('')
const collectionId = ref('')
const sort = ref<'relevance' | 'recent'>('relevance')
let requestId = 0

const queryValue = (value: unknown) => Array.isArray(value) ? value[0] : value
const currentQuery = computed(() => typeof queryValue(route.query.q) === 'string' ? queryValue(route.query.q) as string : '')
const currentTag = computed(() => typeof queryValue(route.query.tag) === 'string' ? queryValue(route.query.tag) as string : '')
const currentAuthorID = computed(() => typeof queryValue(route.query.author_id) === 'string' ? queryValue(route.query.author_id) as string : '')
const currentChannelId = computed(() => typeof queryValue(route.query.channel_id) === 'string' ? queryValue(route.query.channel_id) as string : '')
const currentCollectionID = computed(() => typeof queryValue(route.query.collection_id) === 'string' ? queryValue(route.query.collection_id) as string : '')
const currentSort = computed<'relevance' | 'recent'>(() => queryValue(route.query.sort) === 'recent' ? 'recent' : 'relevance')
const sortOptions: { label: string; value: 'relevance' | 'recent' }[] = [
  { label: '相关性', value: 'relevance' },
  { label: '最新', value: 'recent' },
]
const channelOptions = computed(() => [
  { label: '全部频道', value: '' },
  ...channels.value.map(channel => ({ label: channel.name, value: String(channel.id) })),
])
const authorOptions = computed(() => {
  const authors = new Map<string, string>()
  for (const channel of channels.value) {
    const id = channel.user?.uuid
    if (!id || authors.has(id)) continue
    authors.set(id, channel.user?.display_name || channel.user?.username || id)
  }
  return [
    { label: '全部作者', value: '' },
    ...Array.from(authors, ([value, label]) => ({ value, label })),
  ]
})
const collectionOptions = computed(() => [
  { label: '全部合集', value: '' },
  ...collections.value.map(collection => ({ label: collection.name, value: String(collection.id) })),
])
const sortedPosts = computed(() => posts.value)
const popularTags = computed(() => {
  const counts = new Map<string, number>()
  for (const post of posts.value) {
    for (const tag of post.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([, left], [, right]) => right - left)
    .slice(0, 12)
    .map(([tag]) => tag)
})

const updateQuery = (next: {
  q?: string
  tag?: string
  author_id?: string
  channel_id?: string
  collection_id?: string
  sort?: 'relevance' | 'recent'
}) => {
  const query = { ...route.query }
  for (const [key, value] of Object.entries(next)) {
    if (value) query[key] = value
    else delete query[key]
  }
  void router.replace({ query })
}

const submitSearch = () => updateQuery({ q: searchInput.value.trim(), tag: '' })
const changeAuthor = (value: string | number) => updateQuery({ author_id: String(value) })
const changeChannel = (value: string | number) => {
  collectionId.value = ''
  updateQuery({ channel_id: String(value), collection_id: '' })
}
const changeCollection = (value: string | number) => updateQuery({ collection_id: String(value) })
const changeSort = (value: 'relevance' | 'recent') => updateQuery({ sort: value })
const selectChannel = (id: string | number) => updateQuery({ channel_id: String(id) })
const searchTag = (tag: string) => updateQuery({ q: '', tag, author_id: '', channel_id: '', collection_id: '' })
const clearTag = () => updateQuery({ tag: '' })
const openPost = (post: Post) => blogSheets.openPost(post.id, post.title)

const fetchChannels = async () => {
  try {
    const response = await apiRequestResult(api.blog.channels)
    if (!response.ok) return
    const data = await Promise.resolve(response.data) as { data?: BlogChannel[] }
    channels.value = Array.isArray(data.data) ? data.data : []
  } catch (reason) {
    reportError(reason, 'Failed to fetch blog channels:')
  }
}

const fetchCollections = async (nextChannelID: string) => {
  collections.value = []
  if (!nextChannelID) return
  collectionsLoading.value = true
  try {
    const response = await apiRequestResult(api.blog.channelCollections(nextChannelID))
    if (!response.ok) return
    const payload = await Promise.resolve(response.data) as { data?: BlogCollection[] } | BlogCollection[]
    const items = Array.isArray(payload) ? payload : payload.data
    collections.value = Array.isArray(items) ? items : []
  } catch (reason) {
    reportError(reason, 'Failed to fetch blog collections:')
  } finally {
    collectionsLoading.value = false
  }
}

const toSearchPost = (item: BlogSearchResult): Post => {
  const timestamp = item.published_at || item.created_at
  return {
    id: item.id,
    user_id: item.user?.uuid || '',
    user: item.user as Post['user'],
    channel_id: item.channel?.id ? String(item.channel.id) : undefined,
    channel: item.channel as Post['channel'],
    title: item.title,
    content: item.snippet || item.summary || '',
    summary: item.snippet || item.summary || '',
    cover_url: item.cover_url,
    status: 'published',
    visibility: 'public',
    pinned: false,
    created_at: timestamp,
    updated_at: timestamp,
    tags: [],
  }
}

const fetchPosts = async (append = false) => {
  const targetPage = append ? page.value + 1 : 1
  const currentRequestId = ++requestId
  loading.value = true
  error.value = false
  try {
    const searchMode = Boolean(currentQuery.value.trim() || currentTag.value.trim())
    const params = new URLSearchParams()
    if (searchMode) {
      if (currentQuery.value.trim()) params.set('q', currentQuery.value.trim())
      if (currentTag.value.trim()) params.set('tag', currentTag.value.trim())
      if (currentAuthorID.value) params.set('author_id', currentAuthorID.value)
      if (currentChannelId.value) params.set('channel_id', currentChannelId.value)
      if (currentCollectionID.value) params.set('collection_id', currentCollectionID.value)
      params.set('sort', currentSort.value)
    } else {
      if (currentAuthorID.value) params.set('user_id', currentAuthorID.value)
      if (currentChannelId.value) params.set('channel_id', currentChannelId.value)
      if (currentCollectionID.value) params.set('collection_id', currentCollectionID.value)
    }
    params.set('page', String(targetPage))
    params.set('page_size', String(PAGE_SIZE))
    const endpoint = searchMode ? api.blog.search : api.blog.posts
    const response = await apiRequestResult(`${endpoint}?${params}`)
    if (currentRequestId !== requestId) return
    if (!response.ok) throw new Error(`Failed to fetch blog posts (${response.status})`)
    const data = await Promise.resolve(response.data) as { data?: Post[]; meta?: { has_more?: boolean } }
    const rawItems = Array.isArray(data.data) ? data.data : []
    const items = searchMode
      ? rawItems.map(item => toSearchPost(item as BlogSearchResult))
      : rawItems as Post[]
    posts.value = append ? [...posts.value, ...items] : items
    page.value = targetPage
    hasMore.value = Boolean(data.meta?.has_more)
  } catch (reason) {
    if (currentRequestId !== requestId) return
    reportError(reason, 'Failed to fetch blog posts:')
    error.value = true
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}

const loadMore = () => {
  if (!loading.value && hasMore.value) void fetchPosts(true)
}

watch([currentQuery, currentTag, currentChannelId, currentSort], () => {
  searchInput.value = currentQuery.value
  authorId.value = currentAuthorID.value
  channelId.value = currentChannelId.value
  collectionId.value = currentCollectionID.value
  sort.value = currentSort.value
  void fetchPosts()
})

watch([currentAuthorID, currentCollectionID], () => {
  authorId.value = currentAuthorID.value
  collectionId.value = currentCollectionID.value
  void fetchPosts()
})

watch(currentChannelId, (value, previous) => {
  channelId.value = value
  if (value !== previous) void fetchCollections(value)
})

onMounted(() => {
  searchInput.value = currentQuery.value
  authorId.value = currentAuthorID.value
  channelId.value = currentChannelId.value
  collectionId.value = currentCollectionID.value
  sort.value = currentSort.value
  void Promise.all([fetchPosts(), fetchChannels(), fetchCollections(currentChannelId.value)])
})
</script>

<style scoped>
.blog-articles__filters {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) repeat(4, minmax(8rem, 12rem)) auto;
  align-items: end;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.blog-articles__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--a-recommendation-width);
  align-items: start;
  gap: var(--a-content-column-gap);
}

.blog-articles__list,
.blog-articles__skeletons {
  display: grid;
  gap: 0.75rem;
}

.blog-articles__rail {
  position: sticky;
  top: 1rem;
  display: grid;
  gap: 1.5rem;
}

.blog-articles__rail-section {
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.blog-articles__rail-section h2 {
  margin: 0 0 0.75rem;
  color: var(--a-color-text);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0;
}

.blog-articles__channel-list,
.blog-articles__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.blog-articles__channel,
.blog-articles__tag {
  border: 0;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  padding: 0.25rem 0;
  text-align: left;
}

.blog-articles__channel:hover,
.blog-articles__tag:hover {
  color: var(--a-color-primary);
}

.blog-articles__tag {
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
}

@media (max-width: 1199px) {
  .blog-articles__layout {
    grid-template-columns: 1fr;
  }

  .blog-articles__rail {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 840px) {
  .blog-articles__filters {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 540px) {
  .blog-articles__filters,
  .blog-articles__rail {
    grid-template-columns: 1fr;
  }
}
</style>
