<template>
  <div class="forum-page">
    <main class="forum-main">
      <PPageHeader title="论坛" mb="1.25rem">
        <template #action>
          <div class="forum-header-actions">
            <PButton
              v-if="authStore.isAuthenticated && canCreateTopic"
              @click="router.push('/forum/new')"
            >
              发新话题
            </PButton>
            <PButton
              v-if="authStore.isAuthenticated && canRequestCategory"
              variant="secondary"
              @click="catReqModalOpen = true"
            >
              申请分类
            </PButton>
          </div>
        </template>
      </PPageHeader>

      <ForumTopicFilters
        :active-tab="activeTab"
        :tab-options="tabOptions"
        :selected-category-value="selectedCategoryValue"
        :category-options="categoryOptions"
        :active-tag="activeTag"
        :search-query="searchQuery"
        :active-follow-target="activeFollowTarget"
        :following="activeFollowTarget ? forumStore.isFollowing(activeFollowTarget.targetType, activeFollowTarget.targetKey) : false"
        @update:active-tab="setTab($event as TabKey)"
        @update:selected-category-value="selectedCategoryValue = String($event)"
        @clear-tag="clearTag"
        @update:search-query="searchQuery = $event"
        @submit-search="doSearch"
        @clear-search="clearSearch"
        @toggle-follow="forumStore.toggleFollow($event.targetType, $event.targetKey)"
      />

      <PContentProgress
        :loading="forumStore.topicsLoading"
        :error="forumStore.error"
        :retry="() => loadTopics(true)"
      >
        <template #skeleton>
          <div class="topic-list">
            <div v-for="i in 6" :key="i" style="padding: 1rem 0; border-bottom: 1px solid var(--a-color-border-soft);">
              <PSkeleton width="40%" height="20px" style="margin-bottom: 8px;" />
              <PSkeleton width="80%" height="16px" />
            </div>
          </div>
        </template>

        <!-- Empty state -->
        <PEmpty v-if="forumStore.topics.length === 0" title="暂无话题" description="暂时没有公开话题，可先浏览讨论分类。">
          <template #action>
            <RouterLink class="forum-empty-categories-link" to="/forum/categories">浏览分类</RouterLink>
          </template>
        </PEmpty>

        <!-- Topic rows -->
        <div v-else ref="topicListRef" class="topic-list">
        <PContentCard
          v-for="(topic, index) in forumStore.topics"
          :key="topic.id"
          :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
          @click="router.push(`/forum/topic/${topic.id}`)"
        >
          <!-- Tags / Category badge -->
          <template #meta>
            <span v-if="topicState(topic).pinned" class="tr-badge a-badge tr-badge-pin">置顶</span>
            <span v-if="topicState(topic).closed" class="tr-badge a-badge tr-badge-closed">已关闭</span>
            <span
              v-if="topic.category"
              class="tr-badge a-badge tr-badge-cat"
              :style="{ borderColor: topic.category.color, color: topic.category.color }"
              @click.stop="selectCategory(topic.category!.id)"
            >{{ topic.category.name }}</span>
            <span
              v-for="tag in (topic.tags || []).slice(0, 2)"
              :key="tag"
              class="tr-badge a-badge tr-badge-tag"
              @click.stop="filterByTag(tag)"
            ># {{ tag }}</span>
            <span class="tr-sep">·</span>
            <span class="tr-author">{{ topic.user?.display_name || topic.user?.username || '匿名' }}</span>
            <span class="tr-sep">·</span>
            <span>{{ formatTime(topic.created_at) }}</span>
          </template>

          <!-- Title -->
          <template #title>
            <RouterLink
              :to="`/forum/topic/${topic.id}`"
              class="topic-title-link"
              @click.stop
            >{{ topic.title }}</RouterLink>
          </template>

          <template #actions>
            <div class="topic-entry-actions">
              <div class="tr-avatars">
                <PAvatar
                  :src="topic.user?.avatar_url"
                  :name="topic.user?.display_name || topic.user?.username || '匿名'"
                  size="xs"
                />
              </div>
              <span class="topic-entry-stat">
                回复 {{ topic.reply_count }} · 浏览 {{ formatCount(topic.view_count) }}
              </span>
              <span v-if="topic.last_reply_at" class="topic-entry-last">
                最后回复: {{ formatTime(topic.last_reply_at) }}
              </span>
            </div>
          </template>
        </PContentCard>
      </div>
      </PContentProgress>

      <!-- Load more -->
      <div v-if="hasMore && !forumStore.topicsLoading" class="load-more-wrap">
        <PButton variant="secondary" @click="loadMore" :loading="loadingMore">加载更多</PButton>
      </div>
    </main>
  </div>

  <!-- Category Request Modal -->
  <PModal v-if="catReqModalOpen" @close="catReqModalOpen = false" size="md">
    <h3 class="a-subtitle forum-modal-title">申请新分类</h3>
    <div class="forum-modal-fields">
      <PInput v-model="catReqForm.name" label="分类名称 *" placeholder="分类名称" />
      <PTextarea v-model="catReqForm.description" label="描述" :rows="3" placeholder="分类用途说明" />
      <PTextarea v-model="catReqForm.reason" label="申请说明 *" :rows="4" placeholder="填写申请说明" />
      <p v-if="catReqError" class="forum-modal-error">{{ catReqError }}</p>
      <p v-if="catReqSuccess" class="forum-modal-success">{{ catReqSuccess }}</p>
    </div>
    <div class="forum-modal-actions">
      <PButton variant="secondary" @click="catReqModalOpen = false">取消</PButton>
      <PButton @click="submitCategoryRequest">提交申请</PButton>
    </div>
  </PModal>
</template>

<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { searchLocation, unifiedSearchEnabled } from '@/utils/searchUrl'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useForumStore } from '@/stores/forum'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import ForumTopicFilters from '@/components/forum/ForumTopicFilters.vue'
import PButton from '@/components/ui/PButton.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PModal from '@/components/ui/PModal.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import { useApiUrl } from '@/composables/useApi'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { useUIStore } from '@/stores/ui'
import type { ForumTopic } from '@/types'

type TabKey = 'latest' | 'top'

const router = useRouter()
const route = useRoute()
const forumStore = useForumStore()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const canCreateTopic = computed(() => siteAccessStore.isFeatureEnabled('forum', 'topic.create'))
const canRequestCategory = computed(() => siteAccessStore.isFeatureEnabled('forum', 'category.request'))

const activeCategoryId = computed(() => {
  const cid = route.query.category_id
  return typeof cid === 'string' ? cid : null
})
const activeTab = ref<TabKey>('latest')
const activeTag = computed(() => {
  const t = route.query.tag
  return typeof t === 'string' ? t : ''
})
const activeFollowTarget = computed(() => {
  if (!authStore.isAuthenticated) return null
  if (activeTag.value) return { targetType: 'tag' as const, targetKey: activeTag.value }
  if (activeCategoryId.value) return { targetType: 'category' as const, targetKey: activeCategoryId.value }
  return null
})
const page = ref(1)
const loadingMore = ref(false)
const hasMore = ref(false)
let topicsGeneration = 0
let loadingGeneration: number | null = null
let isUnmounted = false

const uiStore = useUIStore()

const { focusedIndex } = useKeyboardList({
  items: computed(() => forumStore.topics),
  onEnter: (topic) => {
    router.push(`/forum/topic/${topic.id}`)
  },
  section: 'content',
  scrollSelector: '.p-entry.is-focused'
})
const searchQuery = ref('')
const topicListRef = ref<HTMLElement | null>(null)
const ALL_CATEGORY_VALUE = '__all__'

const tabOptions: Record<TabKey, string> = {
  latest: '最新',
  top: '最热',
}

const sortMap: Record<TabKey, 'latest' | 'top'> = {
  latest: 'latest',
  top: 'top',
}

const categoryOptions = computed(() => [
  { label: '全部分类', value: ALL_CATEGORY_VALUE },
  ...forumStore.categories.map((cat) => ({ label: cat.name, value: String(cat.id) })),
])

const selectedCategoryValue = computed<string>({
  get: () => activeCategoryId.value ?? ALL_CATEGORY_VALUE,
  set: (value: string) => {
    void selectCategory(value === ALL_CATEGORY_VALUE ? null : value)
  },
})

// ─── Formatters ──────────────────────────────────────────────────────────────

const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const formatCount = (n: number) => {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const topicState = (topic: ForumTopic) => topic.state ?? {
  closed: Boolean(topic.closed),
  solved: Boolean(topic.is_solved),
  pinned: Boolean(topic.pinned),
  featured: Boolean(topic.featured),
}

// ─── Data loading ─────────────────────────────────────────────────────────────

const invalidateTopicPagination = () => {
  topicsGeneration++
  loadingGeneration = null
  loadingMore.value = false
  hasMore.value = false
  return topicsGeneration
}

const loadTopics = async (resetPage = true) => {
  const generation = invalidateTopicPagination()
  if (resetPage) {
    page.value = 1
    focusedIndex.value = -1
  }
  forumStore.topicsLoading = true
  forumStore.loading = true
  forumStore.error = null
  try {
    const query = new URLSearchParams({
      sort: sortMap[activeTab.value],
      page: String(page.value),
      page_size: '20',
    })
    if (activeCategoryId.value) query.set('category_id', activeCategoryId.value)
    if (activeTag.value) query.set('tag', activeTag.value)
    const res = await apiRequestResult(`${API_URL}/forum/topics?${query}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) {
      if (generation === topicsGeneration) forumStore.error = '加载话题失败'
      return
    }
    const data: unknown = await Promise.resolve(res.data)
    if (generation !== topicsGeneration) return
    if (!isTopicPageEnvelope(data, page.value)) return
    forumStore.topics = data.data
    forumStore.topicsTotal = data.meta.total
    hasMore.value = data.meta.has_more
  } catch {
    if (generation === topicsGeneration) {
      forumStore.error = 'Failed to fetch topics'
    }
  } finally {
    if (generation === topicsGeneration) {
      forumStore.topicsLoading = false
      forumStore.loading = false
    }
  }
}

const selectCategory = (id: string | null) => {
  const query = { ...route.query }
  if (id === null) {
    delete query.category_id
  } else {
    query.category_id = String(id)
  }
  void router.push({ path: '/forum', query })
}

const setTab = async (tab: TabKey) => {
  activeTab.value = tab
  await loadTopics()
}

const filterByTag = (tag: string) => {
  const query = { ...route.query }
  query.tag = tag
  void router.push({ path: '/forum', query })
}

const clearTag = () => {
  const query = { ...route.query }
  delete query.tag
  void router.push({ path: '/forum', query })
}

watch(
  () => route.query,
  () => {
    void loadTopics(true)
  },
  { deep: true }
)

type TopicPageEnvelope = {
  data: ForumTopic[]
  meta: {
    page: number
    page_size: number
    total: number
    has_more: boolean
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isTopicPageEnvelope = (value: unknown, expectedPage: number): value is TopicPageEnvelope => {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.meta)) return false

  const { page: responsePage, page_size: pageSize, total, has_more: hasMore } = value.meta
  if (
    typeof responsePage !== 'number'
    || !Number.isInteger(responsePage)
    || responsePage !== expectedPage
    || typeof pageSize !== 'number'
    || !Number.isInteger(pageSize)
    || pageSize !== 20
    || typeof total !== 'number'
    || !Number.isInteger(total)
    || total < 0
    || !Object.prototype.hasOwnProperty.call(value.meta, 'has_more')
    || typeof hasMore !== 'boolean'
  ) return false

  return true
}

const loadMore = async () => {
  const generation = topicsGeneration
  if (!hasMore.value || loadingGeneration === generation) return
  loadingGeneration = generation
  loadingMore.value = true
  const nextPage = page.value + 1
  try {
    const query = new URLSearchParams({
      page: String(nextPage),
      page_size: '20',
      sort: sortMap[activeTab.value],
    })
    if (activeCategoryId.value) query.set('category_id', activeCategoryId.value)
    if (activeTag.value) query.set('tag', activeTag.value)
    const res = await apiRequestResult(`${API_URL}/forum/topics?${query}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) {
      if (generation === topicsGeneration) forumStore.error = '加载更多话题失败'
      return
    }
    const data: unknown = await Promise.resolve(res.data)
    if (generation !== topicsGeneration) return
    if (!isTopicPageEnvelope(data, nextPage)) return
    const existingIDs = new Set(forumStore.topics.map(topic => topic.id))
    const newTopics = data.data.filter((topic) => {
      if (existingIDs.has(topic.id)) return false
      existingIDs.add(topic.id)
      return true
    })
    forumStore.topics.push(...newTopics)
    forumStore.topicsTotal = data.meta.total
    page.value = nextPage
    hasMore.value = data.meta.has_more
  } catch {
    if (generation === topicsGeneration) forumStore.error = '加载更多话题失败'
  } finally {
    if (loadingGeneration === generation) {
      loadingGeneration = null
      loadingMore.value = false
    }
  }
}

// ─── Search ──────────────────────────────────────────────────────────────────

let searchTimer: ReturnType<typeof setTimeout> | null = null

const doSearch = () => {
  if (searchQuery.value.trim()) {
    router.push(unifiedSearchEnabled ? searchLocation(searchQuery.value, 'forum') : `/forum/search?q=${encodeURIComponent(searchQuery.value.trim())}`)
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  if (searchTimer) clearTimeout(searchTimer)
}

// ─── Keyboard navigation ─────────────────────────────────────────────────────

useKeyboardShortcuts([
  {
    key: 'n',
    description: '发布新帖',
    handler: () => {
      if (authStore.isAuthenticated) router.push('/forum/new')
    },
  },
  {
    key: '/',
    description: '聚焦搜索',
    handler: () => {
      document.querySelector<HTMLInputElement>('.forum-topic-filters input')?.focus()
    },
  },
])

onMounted(async () => {
  await Promise.all([
    forumStore.fetchCategories(),
    authStore.isAuthenticated ? forumStore.fetchFollows() : Promise.resolve(),
  ])
  if (isUnmounted) return
  await loadTopics(true)
})

onBeforeUnmount(() => {
  isUnmounted = true
  invalidateTopicPagination()
  forumStore.topicsLoading = false
  forumStore.loading = false
  if (searchTimer) clearTimeout(searchTimer)
})

// Category Request
const API_URL = useApiUrl()
const catReqModalOpen = ref(false)
const catReqForm = ref({ name: '', description: '', reason: '' })
const catReqError = ref('')
const catReqSuccess = ref('')

const submitCategoryRequest = async () => {
  catReqError.value = ''
  catReqSuccess.value = ''
  if (!catReqForm.value.name.trim() || !catReqForm.value.reason.trim()) {
    catReqError.value = '请填写分类名称和申请说明'
    return
  }
  const res = await apiRequestResult(`${API_URL}/forum/category-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    body: JSON.stringify(catReqForm.value),
  })
  if (res.ok) {
    catReqForm.value = { name: '', description: '', reason: '' }
    catReqSuccess.value = '申请已提交'
    setTimeout(() => {
      catReqModalOpen.value = false
      catReqSuccess.value = ''
    }, 1500)
  } else {
    const d = await Promise.resolve(res.data)
    catReqError.value = `提交失败: ${d?.error || '请稍后重试'}`
  }
}
</script>

<style scoped>
@import "./forumHome.css";
</style>
