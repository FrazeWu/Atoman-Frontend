<template>
  <div class="a-page-xl" style="padding-bottom:12rem">
    <div class="a-section-header" style="margin-bottom:2rem">
      <h1 class="a-title a-accent-l">收藏</h1>
      <PButton size="sm" outline @click="showNewFolder = true">+ 新建收藏夹</PButton>
    </div>

    <div style="display:flex;min-height:60vh;gap:2rem">
      <!-- Left: Folder list -->
      <div style="width:14rem;flex-shrink:0;display:flex;flex-direction:column;gap:0.5rem">
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
      <div style="flex:1;padding:1.5rem">
        <div v-if="loadingPosts" class="a-grid-2">
          <div v-for="i in 4" :key="i" class="a-skeleton" style="height:9rem" />
        </div>
        <PEmpty v-else-if="!filteredBookmarks.length" text="暂无收藏" />
        <div v-else class="a-grid-2">
          <PEntry
            v-for="bm in filteredBookmarks"
            :key="bm.id"
            :title="bm.post?.title"
            :summary="bm.post?.summary"
            @click="$router.push('/posts/post/' + bm.post?.id)"
            class="a-cursor-pointer"
          >
            <template #visual>
              <img
                v-if="bm.post?.cover_url"
                :src="bm.post?.cover_url"
                class="blog-entry-cover"
              />
              <PAvatar
                v-else
                :src="bm.post?.user?.avatar_url"
                :name="bm.post?.user?.display_name || bm.post?.user?.username"
                size="sm"
              />
            </template>

            <template #meta>
              <a :href="userUrl(bm.post?.user?.username || '')" class="a-muted" @click.stop>{{ bm.post?.user?.display_name || bm.post?.user?.username }}</a>
              <span>{{ formatDate(bm.post?.created_at || '') }}</span>
            </template>

            <template #actions>
              <div style="display:flex;gap:1.5rem;align-items:center;width:100%">
                <div style="display:flex;gap:1rem;color:var(--a-color-muted-soft);font-size:0.75rem;font-weight:700">
                  <span>♥ {{ bm.post?.likes_count || 0 }}</span>
                  <span>💬 {{ bm.post?.comments_count || 0 }}</span>
                </div>
              </div>
            </template>
          </PEntry>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PEntry from '@/components/ui/PEntry.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { userUrl } from '@/composables/useSubdomainNav'
import type { Bookmark, BookmarkFolder } from '@/types'

const authStore = useAuthStore()
const api = useApi()
const router = useRouter()

const folders = ref<BookmarkFolder[]>([])
const bookmarks = ref<Bookmark[]>([])
const activeFolder = ref<string | null>(null)
const loadingPosts = ref(true)
const showNewFolder = ref(false)
const newFolderName = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteFolderId = ref<string | null>(null)

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
  loadingPosts.value = true
  try {
    const [fRes, bRes] = await Promise.all([
      fetch(api.blog.bookmarkFolders, { headers: authHeader.value }),
      fetch(api.blog.bookmarks, { headers: authHeader.value })
    ])
    if (fRes.ok) folders.value = (await fRes.json()).data || []
    if (bRes.ok) bookmarks.value = (await bRes.json()).data || []
  } catch (e) {
    console.error(e)
  } finally {
    loadingPosts.value = false
  }
}

const createFolder = async () => {
  if (!newFolderName.value.trim()) return
  try {
    const res = await fetch(api.blog.bookmarkFolders, {
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
    console.error(e)
  }
}

const deleteFolder = async (id: string) => {
  try {
    await fetch(api.blog.bookmarkFolder(id), { method: 'DELETE', headers: authHeader.value })
    if (activeFolder.value === id) activeFolder.value = null
    await fetchAll()
  } catch (e) {
    console.error(e)
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
  cancelDeleteFolder()
  if (id !== null) {
    await deleteFolder(id)
  }
}

onMounted(fetchAll)
</script>

<style scoped>
.blog-entry-cover {
  width: 5.5rem;
  height: 5.5rem;
  object-fit: cover;
  border: 1px solid var(--a-color-line-soft);
  filter: grayscale(100%);
  flex-shrink: 0;
  border-radius: 8px;
}
.sidebar-item {
  width: 100%;
  text-align: left;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  border-radius: 0px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}
.sidebar-item:hover {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}
.sidebar-item-active {
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink);
  font-weight: 900;
  box-shadow: var(--a-shadow-paper-sm);
}
.delete-btn {
  font-size: 0.75rem;
  font-weight: 900;
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
</style>
