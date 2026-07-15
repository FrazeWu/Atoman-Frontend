<template>
  <div class="a-page-xl blog-subscriptions-page">
    <BookmarkFolderModal ref="bookmarkModalRef" />
    <PPageHeader title="订阅" accent>
      <template #action>
        <PButton
          data-testid="manage-subscriptions"
          outline
          size="sm"
          @click="openSubscriptionManager"
        >
          管理订阅
        </PButton>
      </template>
    </PPageHeader>

    <section v-if="authStore.isAuthenticated" class="subscription-filters" aria-label="博客订阅筛选">
      <div class="subscription-kinds" role="group" aria-label="来源类别">
        <PTab
          v-for="kind in sourceKinds"
          :key="kind.value"
          :data-testid="`kind-${kind.value}`"
          :active="currentKind === kind.value"
          @click="selectKind(kind.value)"
        >
          {{ kind.label }}
        </PTab>
      </div>

      <div v-if="kindGroups.length" class="filter-row" aria-label="订阅分组">
        <span class="filter-label">分组</span>
        <button
          type="button"
          class="filter-chip"
          :class="{ 'is-active': !selectedGroupId }"
          @click="selectGroup(null)"
        >
          不限分组
        </button>
        <button
          v-for="group in kindGroups"
          :key="group.id"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': selectedGroupId === group.id }"
          :data-group-id="group.id"
          @click="selectGroup(group.id)"
        >
          {{ group.name }}
        </button>
      </div>

      <div v-if="visibleSubscriptions.length" class="source-row" aria-label="订阅来源">
        <button
          v-for="subscription in visibleSubscriptions"
          :key="subscription.id"
          type="button"
          class="source-option"
          :class="{ 'is-active': selectedSourceId === subscription.id }"
          :data-source-id="subscription.id"
          @click="selectSource(subscription.id)"
        >
          <PAvatar
            v-if="currentKind === 'author'"
            :src="subscription.feed_source?.cover_url"
            :name="sourceTitle(subscription)"
            size="xs"
          />
          <img
            v-else-if="subscription.feed_source?.cover_url"
            :src="subscription.feed_source.cover_url"
            :alt="sourceTitle(subscription)"
            class="source-cover"
          />
          <span v-else class="source-cover source-cover--fallback" aria-hidden="true">
            {{ sourceTitle(subscription).charAt(0) }}
          </span>
          <span>{{ sourceTitle(subscription) }}</span>
        </button>
      </div>
    </section>

    <div v-if="loading && !posts.length" class="a-grid-2">
      <div v-for="i in 6" :key="i" class="a-skeleton" style="height:12rem" />
    </div>

    <PEmpty
      v-else-if="!authStore.isAuthenticated"
      title="请先登录"
      description="登录后查看订阅内容"
    />

    <PEmpty
      v-else-if="!visibleSubscriptions.length"
      :title="`暂无${currentKindLabel}订阅`"
    />

    <PEmpty v-else-if="!posts.length" title="暂无更新" />

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
          <div class="entry-visual">
            <PBadge type="blog">文章</PBadge>
            <img v-if="post.cover_url" :src="post.cover_url" class="blog-entry-cover" />
            <PAvatar
              v-else
              :src="post.user?.avatar_url"
              :name="post.user?.display_name || post.user?.username"
              size="sm"
            />
          </div>
        </template>

        <template #meta>
          <span>《{{ post.channel?.name || '未分类' }}》</span>
          <span>{{ post.user?.display_name || post.user?.username }}</span>
          <span>{{ formatDate(post.created_at) }}</span>
        </template>

        <template #actions>
          <div class="entry-actions">
            <div class="entry-counts">
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

    <div v-if="hasMore && !loading" class="load-more-row">
      <PButton data-testid="load-more" outline @click="loadMore">加载更多</PButton>
    </div>
    <div v-else-if="loading && posts.length" class="load-more-row">
      <p class="a-muted">加载中...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BookmarkFolderModal from '@/components/blog/BookmarkFolderModal.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PClip from '@/components/ui/PClip.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PTab from '@/components/ui/PTab.vue'
import { useApi } from '@/composables/useApi'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { modulePathUrl } from '@/router/siteUrls'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import type { Post, Subscription, TimelineItem } from '@/types'
import { subscriptionDisplayTitle } from '@/utils/feedTitles'

type SourceKind = 'author' | 'channel' | 'collection'

const sourceKinds: Array<{ value: SourceKind; label: string; sourceType: string }> = [
  { value: 'author', label: '作者', sourceType: 'internal_user' },
  { value: 'channel', label: '频道', sourceType: 'internal_channel' },
  { value: 'collection', label: '合集', sourceType: 'internal_collection' },
]

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const uiStore = useUIStore()
const api = useApi()
const bookmarkModalRef = ref<InstanceType<typeof BookmarkFolderModal> | null>(null)

const normalizeKind = (value: unknown): SourceKind =>
  sourceKinds.some((kind) => kind.value === value) ? value as SourceKind : 'author'

const currentKind = computed(() => normalizeKind(route.query.kind))
const currentKindConfig = computed(() => sourceKinds.find((kind) => kind.value === currentKind.value)!)
const currentKindLabel = computed(() => currentKindConfig.value.label)
const selectedGroupId = computed(() => typeof route.query.group === 'string' ? route.query.group : null)
const selectedSourceId = computed(() => typeof route.query.source === 'string' ? route.query.source : null)
const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const kindSubscriptions = computed(() => feedStore.subscriptions.filter(
  (subscription) => subscription.feed_source?.source_type === currentKindConfig.value.sourceType,
))
const kindGroups = computed(() => feedStore.groups.filter((group) =>
  kindSubscriptions.value.some((subscription) => subscription.subscription_group_id === group.id),
))
const visibleSubscriptions = computed(() => selectedGroupId.value
  ? kindSubscriptions.value.filter((subscription) => subscription.subscription_group_id === selectedGroupId.value)
  : kindSubscriptions.value,
)

const posts = ref<Post[]>([])
const loading = ref(true)
const page = ref(1)
const hasMore = ref(false)
const filtersReady = ref(false)
let timelineRequestId = 0

const sourceTitle = (subscription: Subscription) => subscriptionDisplayTitle(subscription)

const replaceQuery = (updates: Record<string, string | null>) => {
  const query = { ...route.query }
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) delete query[key]
    else query[key] = value
  }
  return router.replace({ query })
}

const selectKind = (kind: SourceKind) => {
  if (kind === currentKind.value) return
  page.value = 1
  void replaceQuery({ kind, source: null, page: null })
}

const selectGroup = (groupId: string | null) => {
  page.value = 1
  void replaceQuery({ group: groupId, source: null, page: null })
}

const selectSource = (sourceId: string) => {
  page.value = 1
  void replaceQuery({ source: selectedSourceId.value === sourceId ? null : sourceId, page: null })
}

const openSubscriptionManager = () => {
  void router.push({ path: modulePathUrl('feed', '/'), query: { manage_subscriptions: '1' } })
}

const toggleStar = (id: string) => {
  void bookmarkModalRef.value?.open(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id, 'post')
}

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items: posts,
  section: 'content',
  onEnter: (post) => {
    void router.push('/posts/post/' + post.id)
  },
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

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

const fetchTimeline = async (append = false) => {
  if (!authStore.isAuthenticated) {
    loading.value = false
    return
  }

  const requestId = ++timelineRequestId
  const sourceType = currentKindConfig.value.sourceType
  const sourceId = selectedSourceId.value
  const groupId = selectedGroupId.value
  loading.value = true
  if (!append) page.value = 1
  const requestPage = page.value
  try {
    const params = new URLSearchParams({
      content_type: 'blog',
      source_type: sourceType,
      page: String(requestPage),
      limit: '12',
    })
    if (sourceId) params.set('source_id', sourceId)
    if (groupId) params.set('group_id', groupId)

    const res = await fetch(`${api.feed.timeline}?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) {
      const payload = await res.json()
      if (requestId !== timelineRequestId) return
      const nextPosts = ((payload.data || []) as TimelineItem[])
        .filter((item) => item.type === 'post' && item.post)
        .map((item) => item.post as Post)
      posts.value = append ? [...posts.value, ...nextPosts] : nextPosts
      hasMore.value = payload.meta?.has_more === true
    }
  } catch (error) {
    console.error('Failed to fetch timeline:', error)
  } finally {
    if (requestId === timelineRequestId) loading.value = false
  }
}

const loadMore = () => {
  page.value += 1
  void fetchTimeline(true)
}

watch(
  () => [filtersReady.value, route.path, route.query.kind, route.query.group, route.query.source] as const,
  async ([ready, path, rawKind, rawGroup, rawSource]) => {
    timelineRequestId += 1
    if (!ready || !path.endsWith('/subscriptions')) return
    const kind = normalizeKind(rawKind)
    const sourceType = sourceKinds.find((item) => item.value === kind)!.sourceType
    const groupId = typeof rawGroup === 'string' && feedStore.groups.some((group) => group.id === rawGroup)
      ? rawGroup
      : null
    const sourceId = typeof rawSource === 'string' && feedStore.subscriptions.some((subscription) =>
      subscription.id === rawSource
      && subscription.feed_source?.source_type === sourceType
      && (!groupId || subscription.subscription_group_id === groupId),
    ) ? rawSource : null
    const updates: Record<string, string | null> = {}

    if (rawKind !== kind) {
      updates.kind = kind
      updates.source = null
      updates.page = null
    }
    if (rawGroup !== undefined && rawGroup !== groupId) updates.group = null
    if (rawSource !== undefined && rawSource !== sourceId) updates.source = null

    if (Object.keys(updates).length) {
      await replaceQuery(updates)
      return
    }
    await fetchTimeline()
  },
  { immediate: true },
)

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    loading.value = false
    return
  }
  void feedStore.fetchBookmarkedPostIds()
  void feedStore.fetchReadingListIds()
  await Promise.all([feedStore.fetchSubscriptions(), feedStore.fetchGroups()])
  filtersReady.value = true
})
</script>

<style scoped>
.subscription-filters {
  display: grid;
  gap: 0.8rem;
  margin-bottom: 1.5rem;
  padding-block: 0.35rem 0.9rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.subscription-kinds,
.filter-row,
.source-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  overflow-x: auto;
}

.filter-label {
  flex-shrink: 0;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.filter-chip,
.source-option {
  min-height: 32px;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 4px;
  background: transparent;
  color: var(--a-color-ink-soft);
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}

.filter-chip {
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
}

.source-option {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.65rem 0.3rem 0.35rem;
  font-size: 0.8rem;
}

.filter-chip:hover,
.source-option:hover,
.filter-chip.is-active,
.source-option.is-active {
  border-color: var(--a-color-ink);
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink);
}

.filter-chip.is-active,
.source-option.is-active {
  font-weight: 800;
}

.source-cover {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  border-radius: 3px;
  object-fit: cover;
}

.source-cover--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--a-color-line-soft);
  font-size: 0.65rem;
  font-weight: 800;
}

.entry-visual {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.blog-entry-cover {
  width: 4.5rem;
  height: 4.5rem;
  margin-top: 0.25rem;
  border-radius: 8px;
  filter: grayscale(100%);
  object-fit: cover;
}

.entry-actions,
.entry-counts {
  display: flex;
  align-items: center;
}

.entry-actions {
  width: 100%;
  gap: 1.5rem;
}

.entry-counts {
  gap: 1rem;
  color: var(--a-color-muted-soft);
  font-size: 0.75rem;
  font-weight: 700;
}

.load-more-row {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

@media (max-width: 767px) {
  .filter-chip,
  .source-option {
    min-height: 44px;
  }
}
</style>
