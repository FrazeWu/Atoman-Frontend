<template>
  <div class="a-page-xl bookmark-view">
    <!-- 1. Header with Title and Segmented Control (Aligned with Music LibraryView) -->
    <PPageHeader title="收藏" accent>
      <template #action>
        <PSegmentedControl v-model="kind" :options="kindOptions" />
      </template>
    </PPageHeader>

    <!-- 2. Unauthenticated state -->
    <div v-if="!authStore.isAuthenticated" class="bookmark-unauth">
      <PEmpty
        title="请先登录后查看收藏"
        description="登录账号以同步你的收藏博文与专栏合集。"
      >
        <template #action>
          <PButton to="/login" variant="primary">立即登录</PButton>
        </template>
      </PEmpty>
    </div>

    <!-- 3. Authenticated Content -->
    <template v-else>
      <!-- Toolbar: Sort + Search + Context Action (Aligned with Music Library Toolbar) -->
      <div class="bookmark-toolbar">
        <div class="bookmark-sort">
          <button
            type="button"
            :class="{ active: sortMode === 'latest' }"
            @click="setSort('latest')"
          >
            最新
          </button>
          <button
            type="button"
            :class="{ active: sortMode === 'popular' }"
            @click="setSort('popular')"
          >
            最热
          </button>
          <button
            v-if="kind === 'collection'"
            type="button"
            :class="{ active: sortMode === 'name' }"
            @click="setSort('name')"
          >
            名称
          </button>
        </div>

        <div class="bookmark-toolbar-actions">
          <!-- Post tab: New folder button -->
          <PButton
            v-if="kind === 'post'"
            size="sm"
            variant="secondary"
            @click="showNewFolder = true"
          >
            + 新建收藏夹
          </PButton>

          <!-- Collection tab: Channel filter dropdown -->
          <PSelect
            v-if="kind === 'collection' && channelFilterOptions.length > 1"
            v-model="selectedChannelId"
            :options="channelFilterOptions"
            placeholder="全部频道"
            size="sm"
            class="bookmark-channel-select"
          />
        </div>
      </div>

      <!-- Search Bar -->
      <div class="bookmark-search-row">
        <PInput
          v-model="searchQuery"
          type="search"
          :placeholder="searchPlaceholder"
          :aria-label="searchPlaceholder"
        />
      </div>

      <!-- Error alert -->
      <p v-if="loadError" class="a-error" role="alert">{{ loadError }}</p>

      <!-- TAB 1: 博文 (POSTS) - macOS 访达/备忘录精致边栏卡片布局 -->
      <div v-if="kind === 'post'" class="bookmark-layout">
        <!-- Left: macOS Inset Folders Panel -->
        <div class="bookmark-folders-macos-panel">
          <div class="macos-folders-header">
            <span class="macos-folders-title">收藏夹</span>
            <button
              type="button"
              class="macos-folder-add-icon-btn"
              title="新建收藏夹"
              aria-label="新建收藏夹"
              @click="showNewFolder = true"
            >
              <Plus :size="13" />
            </button>
          </div>
          <div class="macos-folder-list">
            <button
              type="button"
              class="macos-folder-item"
              :class="{ 'is-active': activeFolder === null }"
              @click="activeFolder = null"
            >
              <div class="macos-folder-item-left">
                <Bookmark :size="14" class="macos-folder-icon" />
                <span class="macos-folder-name">全部收藏</span>
              </div>
              <span class="macos-folder-count">{{ bookmarks.length }}</span>
            </button>
            <button
              v-for="folder in folders"
              :key="folder.id"
              type="button"
              class="macos-folder-item"
              :class="{ 'is-active': activeFolder === folder.id }"
              @click="activeFolder = folder.id"
            >
              <div class="macos-folder-item-left">
                <Folder :size="14" class="macos-folder-icon" />
                <span class="macos-folder-name">{{ folder.name }}</span>
              </div>
              <div class="macos-folder-item-right">
                <span class="macos-folder-count">{{ getFolderCount(folder.id) }}</span>
                <span
                  class="macos-folder-delete"
                  title="删除收藏夹"
                  @click.stop="requestDeleteFolder(folder.id)"
                >✕</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Right: Bookmarked posts list -->
        <div class="bookmark-results">
          <div v-if="loadingPosts" class="bookmark-skeleton-list">
            <div v-for="i in 4" :key="i" class="a-skeleton bookmark-skeleton-card" />
          </div>
          <PEmpty
            v-else-if="!filteredBookmarks.length"
            title="暂无收藏博文"
            description="在发现或博文阅读中点击收藏，即可在这里随时查阅。"
          >
            <template #action>
              <PButton variant="primary" size="sm" to="/posts">去发现博文</PButton>
            </template>
          </PEmpty>
          <div v-else class="bookmark-post-list">
            <BlogItemCard
              v-for="bm in filteredBookmarks"
              :key="bm.id"
              :item="bm.content"
              type="post"
              :bookmarked="true"
              :in-reading-list="readingListIds.has(bm.content?.id || '')"
              @click="bm.content && blogSheets.openPost(bm.content.id, bm.content.title)"
              @toggle-bookmark="removeBookmark(bm)"
              @toggle-reading-list="bm.content && toggleReadingList(bm.content.id)"
            />
          </div>
        </div>
      </div>

      <!-- TAB 2: 合集 (COLLECTIONS - Aligned with Music LibraryView cards) -->
      <div v-else-if="kind === 'collection'" class="bookmark-collections-view">
        <div v-if="loadingCollections" class="collections-skeleton-grid">
          <div v-for="i in 6" :key="i" class="a-skeleton collection-skeleton-card" />
        </div>
        <PEmpty
          v-else-if="!filteredCollections.length"
          title="暂无收藏合集"
          description="关注或订阅专栏合集后，最新更新与篇目将在此归集呈现。"
        >
          <template #action>
            <PButton variant="primary" size="sm" to="/posts">探索更多精彩专栏</PButton>
          </template>
        </PEmpty>
        <div v-else class="collections-cards-grid">
          <article
            v-for="c in filteredCollections"
            :key="c.id"
            class="bookmark-collection-card"
            tabindex="0"
            role="button"
            @click="goToCollection(c.id)"
            @keydown.enter.prevent="goToCollection(c.id)"
          >
            <div class="collection-card-header">
              <button
                type="button"
                class="collection-channel-pill"
                @click.stop="goToChannel(c.channel)"
              >
                《{{ c.channel?.name || '官方专栏' }}》
              </button>
              <span v-if="c.is_default" class="collection-default-badge">默认合集</span>
            </div>

            <div class="collection-card-body">
              <h3 class="collection-title">{{ c.name }}</h3>
              <p class="collection-desc a-clamp-2">{{ c.description || '精选深度博文与系列专栏' }}</p>
            </div>

            <div class="collection-card-footer">
              <span class="collection-post-count">
                <Layers :size="13" class="collection-layers-icon" aria-hidden="true" />
                专栏合集
              </span>
              <div class="collection-card-actions" @click.stop>
                <button
                  type="button"
                  class="collection-subscribe-btn"
                  :class="{ 'is-subscribed': isCollectionSubscribed(c.id) }"
                  @click="toggleCollectionSubscription(c)"
                >
                  {{ isCollectionSubscribed(c.id) ? '已订阅' : '订阅' }}
                </button>
                <span class="collection-link-arrow" aria-hidden="true">→</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </template>

    <!-- New folder modal -->
    <PModal v-if="showNewFolder" size="sm" @close="showNewFolder = false">
      <h3 class="a-subtitle" style="margin-bottom:1.25rem">新建收藏夹</h3>
      <input
        v-model="newFolderName"
        placeholder="收藏夹名称"
        class="a-input"
        style="margin-bottom:1rem"
        @keyup.enter="createFolder"
      />
      <div style="display:flex;gap:.5rem">
        <PButton style="flex:1" @click="createFolder">创建</PButton>
        <PButton variant="secondary" @click="showNewFolder = false">取消</PButton>
      </div>
    </PModal>

    <!-- Confirm delete folder modal -->
    <PConfirm
      :show="showDeleteConfirm"
      title="删除收藏夹"
      message="确定删除这个收藏夹吗？"
      confirm-text="删除"
      cancel-text="取消"
      danger
      @confirm="confirmDeleteFolder"
      @cancel="cancelDeleteFolder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bookmark, Folder, Layers, Plus } from 'lucide-vue-next'
import { apiRequestResult } from '@/api/client'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { reportError } from '@/utils/logger'
import type { Bookmark as BookmarkItem, BookmarkFolder, Channel, Collection } from '@/types'

export type BookmarkKind = 'post' | 'collection'
export type BookmarkSortMode = 'latest' | 'popular' | 'name'

interface AugmentedCollection extends Collection {
  channel?: Channel
}

const route = typeof useRoute === 'function' ? useRoute() : undefined
const router = typeof useRouter === 'function' ? useRouter() : undefined
const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()
const blogSheets = useBlogSheets()

// Segmented control tabs
const kindOptions: Array<{ label: string; value: BookmarkKind }> = [
  { label: '博文', value: 'post' },
  { label: '合集', value: 'collection' },
]

const initialTab = route?.query?.tab === 'collection' || route?.query?.tab === 'collections' || route?.query?.kind === 'collection'
  ? 'collection'
  : 'post'
const kind = ref<BookmarkKind>(initialTab)

const sortMode = ref<BookmarkSortMode>('latest')
const searchQuery = ref('')

// Posts state
const folders = ref<BookmarkFolder[]>([])
const bookmarks = ref<BookmarkItem[]>([])
const activeFolder = ref<string | null>(null)
const loadingPosts = ref(true)
const loadError = ref('')
const showNewFolder = ref(false)
const newFolderName = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteFolderId = ref<string | null>(null)
const readingListIds = computed(() => feedStore.readingListItemIds)
let fetchAllSequence = 0

// Collections state
const collections = ref<AugmentedCollection[]>([])
const loadingCollections = ref(false)
const channels = ref<Channel[]>([])
const selectedChannelId = ref('')
const subscribedCollectionIds = ref<Set<string>>(new Set())

const authHeader = computed(() => ({ Authorization: `Bearer ${authStore.token}` }))

const searchPlaceholder = computed(() =>
  kind.value === 'post' ? '搜索收藏博文...' : '搜索合集名称、所属频道或简介...'
)

function getFolderCount(folderId?: string) {
  if (!folderId) return bookmarks.value.length
  return bookmarks.value.filter(b => b.bookmark_folder_id === folderId).length
}

const channelFilterOptions = computed(() => [
  { label: '全部频道', value: '' },
  ...channels.value.map(ch => ({ label: ch.name, value: ch.id })),
])

const filteredBookmarks = computed(() => {
  let list = bookmarks.value.filter(b => b.content)
  if (activeFolder.value !== null) {
    list = list.filter(b => b.bookmark_folder_id === activeFolder.value)
  }
  if (searchQuery.value.trim() && kind.value === 'post') {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(b =>
      (b.content?.title && b.content.title.toLowerCase().includes(q)) ||
      (b.content?.summary && b.content.summary.toLowerCase().includes(q))
    )
  }
  return list
})

const filteredCollections = computed(() => {
  let list = [...collections.value]

  if (selectedChannelId.value) {
    list = list.filter(c => c.channel_id === selectedChannelId.value)
  }

  if (searchQuery.value.trim() && kind.value === 'collection') {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.channel && c.channel.name.toLowerCase().includes(q))
    )
  }

  if (sortMode.value === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  } else if (sortMode.value === 'popular') {
    list.sort((a, b) => {
      const aSub = isCollectionSubscribed(a.id) ? 1 : 0
      const bSub = isCollectionSubscribed(b.id) ? 1 : 0
      return bSub - aSub
    })
  } else {
    list.sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()))
  }

  return list
})

function setSort(mode: BookmarkSortMode) {
  sortMode.value = mode
  if (kind.value === 'post') {
    void fetchAll()
  }
}

// Post actions
const removeBookmark = async (bookmark: BookmarkItem) => {
  try {
    const res = await apiRequestResult(api.blog.bookmark(bookmark.id), {
      method: 'DELETE',
      headers: authHeader.value,
    })
    if (res.ok) bookmarks.value = bookmarks.value.filter((item) => item.id !== bookmark.id)
    else loadError.value = res.error?.message || '取消收藏失败，请重试'
  } catch {
    loadError.value = '取消收藏失败，请重试'
  }
}

const toggleReadingList = (postId: string) => {
  void feedStore.toggleReadingListItem(postId)
}

const fetchAll = async () => {
  const requestSequence = ++fetchAllSequence
  loadingPosts.value = true
  loadError.value = ''
  try {
    const [fRes, bRes] = await Promise.all([
      apiRequestResult(api.blog.bookmarkFolders, { headers: authHeader.value }),
      apiRequestResult(`${api.blog.bookmarks}?sort=${sortMode.value}`, { headers: authHeader.value }),
    ])
    if (requestSequence !== fetchAllSequence) return false
    if (!fRes.ok || !bRes.ok) {
      loadError.value = '收藏加载失败，请稍后重试'
      return false
    }
    const [foldersData, bookmarksData] = [fRes.data, bRes.data]
    if (requestSequence !== fetchAllSequence) return false
    folders.value = foldersData.data || []
    bookmarks.value = bookmarksData.data || []
    return true
  } catch (e) {
    if (requestSequence === fetchAllSequence) loadError.value = '收藏加载失败，请稍后重试'
    reportError(e)
  } finally {
    if (requestSequence === fetchAllSequence) loadingPosts.value = false
  }
  return false
}

const createFolder = async () => {
  if (!newFolderName.value.trim()) return
  try {
    const res = await apiRequestResult(api.blog.bookmarkFolders, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader.value },
      body: JSON.stringify({ name: newFolderName.value }),
    })
    if (res.ok) {
      showNewFolder.value = false
      newFolderName.value = ''
      await fetchAll()
    }
  } catch (e) {
    reportError(e)
  }
}

const deleteFolder = async (id: string) => {
  try {
    const res = await apiRequestResult(api.blog.bookmarkFolder(id), { method: 'DELETE', headers: authHeader.value })
    if (!res.ok) return false
    if (activeFolder.value === id) activeFolder.value = null
    await fetchAll()
    return true
  } catch (e) {
    reportError(e)
    return false
  }
}

const requestDeleteFolder = (id: string) => {
  pendingDeleteFolderId.value = id
  showDeleteConfirm.value = true
}

const cancelDeleteFolder = () => {
  showDeleteConfirm.value = false
  pendingDeleteFolderId.value = null
}

const confirmDeleteFolder = async () => {
  const id = pendingDeleteFolderId.value
  if (id !== null) {
    const deleted = await deleteFolder(id)
    if (deleted) cancelDeleteFolder()
  }
}

// Collection actions
const isCollectionSubscribed = (collectionId: string) => {
  if (subscribedCollectionIds.value.has(String(collectionId))) return true
  return feedStore.subscriptions.some(
    sub => sub.feed_source?.source_type === 'internal_collection' && String(sub.feed_source?.source_id) === String(collectionId)
  )
}

const toggleCollectionSubscription = async (c: AugmentedCollection) => {
  const idStr = String(c.id)
  const isSub = isCollectionSubscribed(idStr)
  if (isSub) {
    subscribedCollectionIds.value.delete(idStr)
    await feedStore.unsubscribeFromCollection(idStr)
  } else {
    subscribedCollectionIds.value.add(idStr)
    await feedStore.subscribeToCollection(idStr)
  }
}

const goToCollection = (id: string | number) => {
  if (router) void router.push(`/posts/collection/${id}`)
}

const goToChannel = (channel?: Channel) => {
  if (router && channel) {
    void router.push(`/posts/channel/${channel.slug || channel.id}`)
  }
}

const fetchCollections = async () => {
  loadingCollections.value = true
  try {
    const channelsRes = await apiRequestResult(api.blog.channels)
    const channelList: Channel[] = Array.isArray(channelsRes.data?.data)
      ? channelsRes.data.data
      : (Array.isArray(channelsRes.data) ? channelsRes.data : [])
    channels.value = channelList

    const channelMap = new Map<string, Channel>()
    channelList.forEach(ch => channelMap.set(String(ch.id), ch))

    const collectionPromises: Promise<AugmentedCollection[]>[] = channelList.map(async (ch): Promise<AugmentedCollection[]> => {
      try {
        const res = await apiRequestResult(api.blog.channelCollections(ch.id))
        const items: Collection[] = Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data) ? res.data : [])
        return items.map(c => ({ ...c, channel: ch }))
      } catch {
        return []
      }
    })

    if (authStore.isAuthenticated) {
      collectionPromises.push(
        (async (): Promise<AugmentedCollection[]> => {
          try {
            const res = await apiRequestResult(api.blog.collections)
            const items: Collection[] = Array.isArray(res.data?.data)
              ? res.data.data
              : (Array.isArray(res.data) ? res.data : [])
            return items.map(c => ({
              ...c,
              channel: c.channel_id ? channelMap.get(String(c.channel_id)) : undefined,
            }))
          } catch {
            return []
          }
        })()
      )
    }

    const results = await Promise.all(collectionPromises)
    const allCollections = results.flat()

    const uniqueMap = new Map<string, AugmentedCollection>()
    for (const c of allCollections) {
      if (c.id && !uniqueMap.has(String(c.id))) {
        uniqueMap.set(String(c.id), c)
      }
    }
    collections.value = Array.from(uniqueMap.values())

    // Populate subscribed collections from feed store
    feedStore.subscriptions.forEach(sub => {
      if (sub.feed_source?.source_type === 'internal_collection' && sub.feed_source?.source_id) {
        subscribedCollectionIds.value.add(String(sub.feed_source.source_id))
      }
    })
  } catch (e) {
    reportError(e)
  } finally {
    loadingCollections.value = false
  }
}

watch(kind, (newKind) => {
  searchQuery.value = ''
  if (router && route) {
    void router.replace({
      query: {
        ...route.query,
        tab: newKind === 'post' ? undefined : 'collection',
      },
    })
  }
  if (newKind === 'collection') {
    if (!collections.value.length) void fetchCollections()
    if (authStore.isAuthenticated) void feedStore.fetchSubscriptions()
  }
})

watch(() => route?.query?.tab, (tab) => {
  if (tab === 'collection' || tab === 'collections') {
    kind.value = 'collection'
  } else if (!tab || tab === 'post') {
    kind.value = 'post'
  }
})

onMounted(() => {
  void fetchAll()
  if (kind.value === 'collection') {
    void fetchCollections()
    if (authStore.isAuthenticated) {
      void feedStore.fetchSubscriptions()
    }
  }
})
</script>

<style scoped>
.bookmark-view {
  padding-bottom: 3rem;
}

.bookmark-unauth {
  padding: 3rem 0;
}

/* Toolbar: 借鉴音乐模块 LibraryView 极简设计，排序切换与上下文操作栏 */
.bookmark-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  margin-bottom: 0.75rem;
}

.bookmark-sort {
  display: flex;
  gap: 0.4rem;
}

.bookmark-sort button {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  padding: 0.35rem 0.65rem;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.bookmark-sort button:hover {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.bookmark-sort button.active {
  color: var(--a-color-fg);
  font-weight: 600;
  background: var(--a-color-surface-muted);
}

.bookmark-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bookmark-channel-select {
  width: 11rem;
}

.bookmark-search-row {
  margin-bottom: 1.25rem;
}

/* ======================================================== */
/* 方案 2（最终定型）：macOS 访达/备忘录精致边栏卡片布局 */
/* ======================================================== */
.bookmark-layout {
  display: flex;
  min-height: 50vh;
  gap: 1.75rem;
}

.bookmark-folders-macos-panel {
  width: 14rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: var(--a-radius-card, 4px);
  padding: 0.5rem;
  align-self: flex-start;
}

.macos-folders-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.5rem 0.5rem;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  margin-bottom: 0.35rem;
}

.macos-folders-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--a-color-muted);
}

.macos-folder-add-icon-btn {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--a-radius-control, 4px);
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.macos-folder-add-icon-btn:hover {
  color: var(--a-color-fg);
  background: var(--a-color-bg);
}

.macos-folder-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.macos-folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: var(--a-radius-control, 4px);
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--a-color-muted);
  transition: all 0.15s ease;
  position: relative;
}

.macos-folder-item:hover {
  background: color-mix(in srgb, var(--a-color-bg) 60%, transparent);
  color: var(--a-color-fg);
}

.macos-folder-item.is-active {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.macos-folder-item-left {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.macos-folder-icon {
  color: var(--a-color-muted);
  flex-shrink: 0;
}

.macos-folder-item.is-active .macos-folder-icon {
  color: var(--a-color-primary, #0071e3);
}

.macos-folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.macos-folder-item-right {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.macos-folder-count {
  font-size: 0.72rem;
  color: var(--a-color-muted);
}

.macos-folder-delete {
  font-size: 0.7rem;
  opacity: 0.4;
  cursor: pointer;
  transition: opacity 0.15s, color 0.15s;
}

.macos-folder-delete:hover {
  opacity: 1;
  color: var(--a-color-danger);
}

/* 博客文章列表容器 */
.bookmark-results {
  flex: 1;
  min-width: 0;
}

.bookmark-post-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.bookmark-post-list :deep(.content-stream-entry) {
  border-top: 0 !important;
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0) !important;
  margin: 0 !important;
}

.bookmark-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bookmark-skeleton-card {
  height: 6rem;
  border-radius: var(--a-radius-card, 4px);
}

/* ======================================================== */
/* 专栏合集收藏大厅：参考音乐模块 LibraryView 网格布局 */
/* ======================================================== */
.bookmark-collections-view {
  min-width: 0;
}

.collections-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1.25rem;
}

.collection-skeleton-card {
  height: 9rem;
  border-radius: var(--a-radius-card, 4px);
}

.collections-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1.25rem;
}

.bookmark-collection-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.15rem 1.25rem;
  border-radius: var(--a-radius-card, 4px);
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  background-color: var(--a-color-bg);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  min-height: 8.5rem;
  outline: none;
}

.bookmark-collection-card:hover,
.bookmark-collection-card:focus-visible {
  border-color: var(--a-color-primary, #0071e3);
  box-shadow: var(--a-shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.04));
  transform: translateY(-1px);
}

.collection-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
}

.collection-channel-pill {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--a-color-primary, #0071e3);
  cursor: pointer;
  text-align: left;
}

.collection-channel-pill:hover {
  text-decoration: underline;
}

.collection-default-badge {
  font-size: 0.68rem;
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted);
  padding: 0.1rem 0.4rem;
  border-radius: var(--a-radius-control, 4px);
}

.collection-card-body {
  flex: 1;
  min-width: 0;
  margin-bottom: 0.75rem;
}

.collection-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-fg);
  margin: 0 0 0.35rem;
  line-height: 1.35;
}

.collection-desc {
  font-size: 0.82rem;
  color: var(--a-color-muted);
  margin: 0;
  line-height: 1.45;
}

.collection-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft, #f0f0f0);
  font-size: 0.78rem;
}

.collection-post-count {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--a-color-muted);
}

.collection-layers-icon {
  color: var(--a-color-muted);
}

.collection-card-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.collection-subscribe-btn {
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.2rem 0.55rem;
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.collection-subscribe-btn:hover {
  border-color: var(--a-color-primary, #0071e3);
  color: var(--a-color-primary, #0071e3);
}

.collection-subscribe-btn.is-subscribed {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft, #f0f0f0);
}

.collection-link-arrow {
  color: var(--a-color-muted);
  font-size: 0.9rem;
  line-height: 1;
  transition: transform 0.15s ease, color 0.15s ease;
}

.bookmark-collection-card:hover .collection-link-arrow {
  color: var(--a-color-primary, #0071e3);
  transform: translateX(2px);
}

@media (max-width: 767px) {
  .bookmark-layout {
    display: block !important;
  }

  .bookmark-folders-macos-panel {
    width: 100% !important;
    margin-bottom: 1rem;
  }

  .bookmark-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .bookmark-toolbar-actions {
    justify-content: flex-end;
  }

  .collections-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
