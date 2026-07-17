<template>
  <div class="forum-page">
    <main class="forum-main">
      <PPageHeader title="论坛" accent sub="浏览话题，参与讨论" mb="1.5rem">
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
              outline
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

      <!-- Loading state -->
      <div v-if="forumStore.loading" class="topic-list">
        <div v-for="i in 8" :key="i" class="topic-row-skeleton a-skeleton" />
      </div>

      <!-- Empty state -->
      <PEmpty v-else-if="forumStore.topics.length === 0" text="暂无话题，来发第一个吧" />

      <!-- Topic rows -->
      <div v-else ref="topicListRef" class="topic-list">
        <PEntry
          v-for="(topic, index) in forumStore.topics"
          :key="topic.id"
          :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
          @click="router.push(`/forum/topic/${topic.id}`)"
        >
          <!-- Tags / Category badge -->
          <template #meta>
            <span v-if="topic.pinned" class="tr-badge a-badge tr-badge-pin">置顶</span>
            <span v-if="topic.closed" class="tr-badge a-badge tr-badge-closed">已关闭</span>
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
            {{ topic.title }}
          </template>

          <template #actions>
            <div class="topic-entry-actions">
              <div class="tr-avatars">
                <div class="tr-avatar tr-avatar-op" :title="topic.user?.display_name || topic.user?.username">
                  {{ avatarInitial(topic.user?.display_name || topic.user?.username) }}
                </div>
              </div>
              <span class="topic-entry-stat">
                回复 {{ topic.reply_count }} · 浏览 {{ formatCount(topic.view_count) }}
              </span>
              <span v-if="topic.last_reply_at" class="topic-entry-last">
                最后回复: {{ formatTime(topic.last_reply_at) }}
              </span>
            </div>
          </template>
        </PEntry>
      </div>

      <!-- Load more -->
      <div v-if="hasMore && !forumStore.loading" class="load-more-wrap">
        <PButton outline @click="loadMore" :loading="loadingMore">加载更多</PButton>
      </div>
    </main>
  </div>

  <!-- Category Request Modal -->
  <PModal v-if="catReqModalOpen" @close="catReqModalOpen = false" size="md">
    <h3 class="a-subtitle forum-modal-title">申请新分类</h3>
    <div class="forum-modal-fields">
      <PInput v-model="catReqForm.name" label="分类名称 *" placeholder="分类名称" />
      <PTextarea v-model="catReqForm.description" label="描述" :rows="3" placeholder="分类用途说明" />
      <PTextarea v-model="catReqForm.reason" label="申请理由 *" :rows="4" placeholder="说明为什么需要此分区" />
    </div>
    <div class="forum-modal-actions">
      <PButton outline @click="catReqModalOpen = false">取消</PButton>
      <PButton @click="submitCategoryRequest">提交申请</PButton>
    </div>
  </PModal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useForumStore } from '@/stores/forum'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import ForumTopicFilters from '@/components/forum/ForumTopicFilters.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PModal from '@/components/ui/PModal.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEntry from '@/components/ui/PEntry.vue'
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

const avatarInitial = (name?: string) => {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
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
    const res = await fetch(`${API_URL}/forum/topics?${query}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) return
    const data: unknown = await res.json()
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
    const res = await fetch(`${API_URL}/forum/topics?${query}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) return
    const data: unknown = await res.json()
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
    // Keep the current page available so the user can retry.
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
    router.push(`/forum/search?q=${encodeURIComponent(searchQuery.value.trim())}`)
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  if (searchTimer) clearTimeout(searchTimer)
}

// ─── Keyboard navigation ─────────────────────────────────────────────────────

const handleKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

  if (e.key === 'n') {
    if (authStore.isAuthenticated) router.push('/forum/new')
  } else if (e.key === '/') {
    e.preventDefault()
    document.querySelector<HTMLInputElement>('.forum-topic-filters input')?.focus()
  }
}

onMounted(async () => {
  await Promise.all([
    forumStore.fetchCategories(),
    authStore.isAuthenticated ? forumStore.fetchFollows() : Promise.resolve(),
  ])
  if (isUnmounted) return
  await loadTopics(true)
  if (isUnmounted) return
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  isUnmounted = true
  invalidateTopicPagination()
  forumStore.loading = false
  window.removeEventListener('keydown', handleKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})

// Category Request
const API_URL = useApiUrl()
const catReqModalOpen = ref(false)
const catReqForm = ref({ name: '', description: '', reason: '' })

const submitCategoryRequest = async () => {
  if (!catReqForm.value.name.trim() || !catReqForm.value.reason.trim()) {
    alert('请填写分区名称和申请理由')
    return
  }
  const res = await fetch(`${API_URL}/forum/category-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    body: JSON.stringify(catReqForm.value),
  })
  if (res.ok) {
    catReqModalOpen.value = false
    catReqForm.value = { name: '', description: '', reason: '' }
    alert('申请已提交，请等待管理员审核')
  } else {
    const d = await res.json()
    alert(`提交失败: ${d.error || '未知错误'}`)
  }
}
</script>

<style scoped>
/* ── Page layout ─────────────────────────────────────────────────────────── */
.forum-page {
  display: flex;
  min-height: calc(100vh - 4rem);
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.forum-sidebar {
  width: 220px;
  flex-shrink: 0;
  padding: 1.5rem 0 2rem;
  border-right: none;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar-section {
  padding: 0.5rem 0;
}

.sidebar-section-label {
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--a-color-muted-soft);
  padding: 0.25rem 1.25rem 0.5rem;
}

.sidebar-divider {
  border-bottom: none;
  margin: 0.5rem 0;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  color: var(--a-color-muted);
  transition: background 0.12s;
  position: relative;
}

.sidebar-item:hover {
  background: var(--a-color-disabled-bg);
}

.sidebar-item-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.sidebar-item-active:hover {
  background: var(--a-color-fg);
}

.sidebar-sub {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--a-color-muted);
  padding-left: 1.75rem;
}

.sidebar-item-icon {
  font-size: 0.75rem;
  width: 1rem;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item-count {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--a-color-muted-soft);
  background: var(--a-color-disabled-bg);
  padding: 0.1rem 0.4rem;
  border-radius: 0px;
}

.sidebar-item-active .sidebar-item-count {
  background: rgba(255, 255, 255, 0.2);
  color: var(--a-color-bg);
}

.sidebar-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Tags in sidebar */
.sidebar-tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: var(--a-font-weight-strong);
  padding: 0.2rem 0.6rem;
  margin: 0.15rem 0.25rem;
  margin-left: 1.25rem;
  border: var(--a-border);
  border-color: var(--a-color-disabled-border);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 0.12s;
}

.sidebar-tag:hover,
.sidebar-tag-active {
  border-color: var(--a-color-fg);
  color: var(--a-color-bg);
  background: var(--a-color-fg);
}

/* Shortcuts */
.sidebar-shortcuts {
  margin-top: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--a-color-disabled-border);
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted-soft);
  line-height: 2.2;
}

kbd {
  display: inline-block;
  padding: 0.05em 0.3em;
  border: 1.5px solid var(--a-color-disabled-border);
  font-size: 0.6rem;
  font-weight: 500;
  font-family: monospace;
  background: var(--a-color-surface);
  color: var(--a-color-muted);
  margin-right: 0.2em;
}

/* ── Main content ────────────────────────────────────────────────────────── */
.forum-main {
  flex: 1;
  min-width: 0;
  padding: 0 0 4rem 0;
}


/* ── Tab bar ─────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: none;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  background: var(--a-color-bg);
  z-index: 10;
}

.tab-bar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tab-bar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.forum-tab-btn {
  box-shadow: none;
}

.forum-tab-btn-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}

/* ── Filter bar ──────────────────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: none;
  gap: 1rem;
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-right {
  display: flex;
  align-items: center;
}

.forum-category-select {
  min-width: 12rem;
}

.forum-category-select :deep(.p-field) {
  gap: 0;
}

.forum-category-select :deep(.p-select-trigger) {
  min-height: 2.5rem;
  font-size: 0.8rem;
  font-weight: var(--a-font-weight-black);
  letter-spacing: 0;
}

/* Active tag chip */
.active-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.tag-chip-close {
  background: none;
  border: none;
  color: var(--a-color-bg);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  opacity: 0.7;
}

.tag-chip-close:hover {
  opacity: 1;
}

/* Search */
.search-wrap {
  position: relative;
}

.search-wrap :deep(.p-field) {
  gap: 0;
}

.search-input {
  width: 200px;
}

.search-input :deep(.p-input) {
  padding-right: 2rem;
  font-size: 0.8rem;
}

.search-clear {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--a-color-muted-soft);
  padding: 0;
  line-height: 1;
}

/* ── Topic list header ───────────────────────────────────────────────────── */
.topic-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.5rem;
  border-bottom: none;
  background: var(--a-color-surface);
}

.th-title {
  color: var(--a-color-muted-soft);
  flex: 1;
}

.th-stats {
  display: flex;
  gap: 0;
  color: var(--a-color-muted-soft);
}

.th-stats span {
  width: 60px;
  text-align: right;
}

/* ── Topic rows ──────────────────────────────────────────────────────────── */
.topic-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.topic-row-skeleton {
  height: 68px;
}

.topic-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  cursor: pointer;
  transition: background 0.1s;
  gap: 1rem;
  margin: 0;
}

.topic-row:hover,
.topic-row-focused {
  background: var(--a-color-surface);
}

.topic-row-pinned {
  background: var(--a-color-surface);
}

/* Left side */
.tr-left {
  flex: 1;
  min-width: 0;
}

.tr-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}

.tr-badge {
  font-size: 0.6rem;
  font-weight: var(--a-font-weight-black);
}

.tr-badge-pin {
  color: var(--a-color-fg);
  text-transform: uppercase;
}

.tr-badge-closed {
  border-color: var(--a-color-disabled-border);
  color: var(--a-color-muted-soft);
  text-transform: uppercase;
}

.tr-badge-cat {
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.1s;
}

.tr-badge-cat:hover {
  background: currentColor;
  color: var(--a-color-bg);
}

.tr-badge-tag {
  border-color: var(--a-color-disabled-border);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 0.1s;
}

.tr-badge-tag:hover {
  border-color: var(--a-color-fg);
  color: var(--a-color-fg);
}

.tr-title {
  font-size: 0.92rem;
  font-weight: 500;
  margin: 0 0 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--a-color-fg);
  transition: color 0.1s;
}

.topic-row:hover .tr-title,
.topic-row-focused .tr-title {
  text-decoration: underline;
}

.tr-meta {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-muted-soft);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.tr-author {
  font-weight: 500;
  color: var(--a-color-muted);
}

.tr-sep {
  color: var(--a-color-disabled-border);
}

.tr-bookmarked {
  font-weight: 500;
  color: var(--a-color-fg);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0;
}

/* Right side */
.tr-right {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-shrink: 0;
}

/* Avatars */
.tr-avatars {
  display: flex;
  align-items: center;
}

.tr-avatar {
  width: 28px;
  height: 28px;
  border: var(--a-border);
  background: var(--a-color-disabled-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.tr-avatar-op {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

/* Stats */
.tr-stats {
  display: flex;
  align-items: center;
}

.tr-stat {
  width: 60px;
  text-align: right;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.tr-stat-val {
  font-weight: 500;
  color: var(--a-color-muted);
}

.tr-stat-time {
  color: var(--a-color-muted-soft);
  font-weight: 600;
  font-size: 0.7rem;
}

/* Load more */
.load-more-wrap {
  padding: 1.5rem;
  text-align: center;
}

.forum-header-actions,
.topic-entry-actions,
.forum-modal-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.topic-entry-stat {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
}

.topic-entry-last {
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
}

.forum-modal-title {
  margin-bottom: 1.25rem;
}

.forum-modal-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.forum-modal-actions {
  justify-content: flex-end;
  margin-top: 1.5rem;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .forum-sidebar {
    width: 180px;
  }
}

@media (max-width: 768px) {
  .forum-page {
    display: block;
    padding: 0;
  }

  .forum-sidebar {
    display: none;
  }

  .forum-main {
    padding-bottom: 4rem;
  }

  .tab-bar {
    padding: 0 0.75rem;
    overflow-x: auto;
  }

  .tab-bar-left {
    flex-wrap: nowrap;
  }

  .filter-bar {
    padding: 0.625rem 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .search-input {
    width: 140px;
  }

  .topic-row {
    padding: 0.75rem;
  }

  .topic-list-header {
    padding: 0.5rem 0.75rem;
  }

  .tr-right {
    gap: 0.75rem;
  }

  .tr-stat {
    width: 46px;
    font-size: 0.7rem;
  }

  .th-stats span {
    width: 46px;
  }
}
</style>
