<template>
  <div class="a-page-xl" style="padding-bottom:12rem">
    <PPageHeader title="收藏" accent>
      <template #action>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <PSegmentedControl v-model="sortMode" :options="sortOptions" />
          <PButton size="sm" outline @click="showNewFolder = true">+ 新建收藏夹</PButton>
        </div>
      </template>
    </PPageHeader>

    <div class="bookmark-layout" style="display:flex;min-height:60vh;gap:2rem">
      <!-- Left: Folder list -->
      <div class="bookmark-folders" style="width:14rem;flex-shrink:0;display:flex;flex-direction:column;gap:0.5rem">
        <button
          @click="activeFolder = null"
          class="sidebar-item"
          :class="{ 'sidebar-item-active': activeFolder === null }"
        >
          <span class="sidebar-item-label">全部收藏</span>
        </button>
        <button
          v-for="folder in folders"
          :key="folder.id"
          @click="activeFolder = folder.id"
          class="sidebar-item"
          :class="{ 'sidebar-item-active': activeFolder === folder.id }"
        >
          <span class="sidebar-item-label">{{ folder.name }}</span>
          <span
            @click.stop="requestDeleteFolder(folder.id)"
            class="delete-btn"
            :style="activeFolder === folder.id ? 'color:#9ca3af' : 'color:#ef4444'"
          >✕</span>
        </button>
      </div>

      <!-- Right: Bookmarked posts -->
      <div class="bookmark-results" style="flex:1;padding:0">
        <div v-if="loadingPosts" class="a-grid-2">
          <div v-for="i in 4" :key="i" class="a-skeleton" style="height:9rem" />
        </div>
        <PEmpty v-else-if="loadError" title="收藏加载失败" :description="loadError" />
        <PEmpty v-else-if="!filteredBookmarks.length" text="暂无收藏" />
        <div v-else class="bookmark-post-list feed-timeline-box">
          <BlogItemCard
            v-for="bm in filteredBookmarks"
            :key="bm.id"
            :item="bm.post"
            type="post"
            :bookmarked="true"
            :in-reading-list="readingListIds.has(bm.post?.id || '')"
            @click="bm.post && blogSheets.openPost(bm.post.id, bm.post.title)"
            @toggle-bookmark="removeBookmark(bm)"
            @toggle-reading-list="bm.post && toggleReadingList(bm.post.id)"
          />
        </div>
      </div>
    </div>

    <!-- New folder modal -->
    <PModal v-if="showNewFolder" @close="showNewFolder = false" size="sm">
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
        <PButton outline @click="showNewFolder = false">取消</PButton>
      </div>
    </PModal>

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
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { ref, computed, onMounted, watch } from 'vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useApi } from '@/composables/useApi'
import { userUrl } from '@/composables/useSubdomainNav'
import { useBlogSheets } from '@/composables/useBlogSheets'
import type { Bookmark, BookmarkFolder } from '@/types'

type BookmarkSortMode = 'latest' | 'popular'

const authStore = useAuthStore()
const feedStore = useFeedStore()
const api = useApi()
const blogSheets = useBlogSheets()

const folders = ref<BookmarkFolder[]>([])
const bookmarks = ref<Bookmark[]>([])
const readingListIds = computed(() => feedStore.readingListItemIds)

const removeBookmark = async (bookmark: Bookmark) => {
  const res = await apiRequestResult(api.blog.bookmark(bookmark.id), {
    method: 'DELETE',
    headers: authHeader.value,
  })
  if (res.ok) bookmarks.value = bookmarks.value.filter((item) => item.id !== bookmark.id)
}

const toggleReadingList = (postId: string) => {
  void feedStore.toggleReadingListItem(postId)
}
const activeFolder = ref<string | null>(null)
const loadingPosts = ref(true)
const loadError = ref('')
const showNewFolder = ref(false)
const newFolderName = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteFolderId = ref<string | null>(null)
const sortMode = ref<BookmarkSortMode>('latest')
let fetchAllSequence = 0

const sortOptions: Array<{ label: string; value: BookmarkSortMode }> = [
  { label: '最新', value: 'latest' },
  { label: '最热', value: 'popular' },
]

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const filteredBookmarks = computed(() => {
  if (activeFolder.value === null) return bookmarks.value.filter(b => b.post)
  return bookmarks.value.filter(b => b.bookmark_folder_id === activeFolder.value && b.post)
})

const authHeader = computed(() => ({ Authorization: `Bearer ${authStore.token}` }))

const fetchAll = async () => {
  const requestSequence = ++fetchAllSequence
  loadingPosts.value = true
  loadError.value = ''
  try {
    const [fRes, bRes] = await Promise.all([
      apiRequestResult(api.blog.bookmarkFolders, { headers: authHeader.value }),
      apiRequestResult(`${api.blog.bookmarks}?sort=${sortMode.value}`, { headers: authHeader.value })
    ])
    if (requestSequence !== fetchAllSequence || !fRes.ok || !bRes.ok) {
      loadError.value = '收藏加载失败，请稍后重试'
      return false
    }
    const [foldersData, bookmarksData] = [fRes.data, bRes.data]
    if (requestSequence !== fetchAllSequence) return false
    folders.value = foldersData.data || []
    bookmarks.value = bookmarksData.data || []
    return true
  } catch (e) {
    loadError.value = '收藏加载失败，请稍后重试'
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
      body: JSON.stringify({ name: newFolderName.value })
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

onMounted(() => {
  void fetchAll()
  if (authStore.isAuthenticated) void feedStore.fetchReadingListIds()
})

watch(sortMode, () => {
  void fetchAll()
})
</script>

<style scoped>
.bookmark-post-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.blog-entry-cover {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.sidebar-item {
  width: 100%;
  text-align: left;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: var(--a-color-text-secondary);
  border-radius: var(--a-radius-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-item:hover {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
}

.sidebar-item-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
  font-weight: 650;
}

.bookmark-post-list.feed-timeline-box {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  background: var(--a-color-bg);
}
.delete-btn {
  font-size: 0.75rem;
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.delete-btn:hover {
  opacity: 1;
}
.a-cursor-pointer {
  cursor: pointer;
}
@media (max-width: 767px) {
  .bookmark-layout {
    display: block !important;
    min-height: 0 !important;
  }

  .bookmark-folders {
    width: 100% !important;
    flex-direction: row !important;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .bookmark-folders .sidebar-item {
    flex: 0 0 auto;
    width: auto;
    min-width: 8rem;
  }

  .bookmark-results {
    padding: 1rem 0 !important;
  }
}
</style>
