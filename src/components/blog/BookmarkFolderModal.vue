<template>
  <PModal v-if="show" title="选择收藏夹" size="sm" @close="close">
    <div class="bookmark-folder-modal">
      <div v-if="loading" class="a-muted">加载中…</div>
      <button
        v-for="folder in folders"
        v-else
        :key="folder.id"
        :data-test="`bookmark-folder-${folder.id}`"
        type="button"
        class="bookmark-folder-option"
        :class="{ active: folder.id === selectedFolderId }"
        @click="saveToFolder(folder.id)"
      >
        <Folder :size="17" />
        <span>{{ folder.name }}</span>
        <Check v-if="folder.id === selectedFolderId" :size="16" />
      </button>

      <div class="bookmark-folder-create">
        <input v-model="newFolderName" type="text" maxlength="40" placeholder="新收藏夹名称" @keydown.enter="createFolder" />
        <PButton variant="secondary" size="sm" :disabled="!newFolderName.trim()" @click="createFolder">新建</PButton>
      </div>
      <p v-if="error" class="a-error">{{ error }}</p>
    </div>
    <template #footer>
      <PButton v-if="bookmarkId" variant="danger" @click="removeBookmark">取消收藏</PButton>
      <PButton variant="secondary" @click="close">关闭</PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Check, Folder } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

type BookmarkFolder = { id: string; name: string }
type BookmarkRecord = { id: string; post_id: string; bookmark_folder_id?: string }

const emit = defineEmits<{
  changed: [payload: { postId: string; saved: boolean }]
}>()

const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const show = ref(false)
const loading = ref(false)
const postId = ref('')
const bookmarkId = ref('')
const selectedFolderId = ref('')
const folders = ref<BookmarkFolder[]>([])
const newFolderName = ref('')
const error = ref('')

const headers = () => ({ Authorization: `Bearer ${authStore.token}` })

const loadFolders = async () => {
  const res = await fetch(api.blog.bookmarkFolders, { headers: headers() })
  if (!res.ok) throw new Error('加载收藏夹失败')
  const payload = await res.json()
  folders.value = payload.data || []
  if (folders.value.length === 0) {
    const createRes = await fetch(api.blog.bookmarkFolders, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '默认收藏夹' }),
    })
    if (!createRes.ok) throw new Error('创建默认收藏夹失败')
    const created = await createRes.json()
    folders.value = [created.data]
  }
}

const open = async (targetPostId: string) => {
  postId.value = targetPostId
  show.value = true
  if (!authStore.isAuthenticated) {
    error.value = '请先登录'
    return
  }
  loading.value = true
  error.value = ''
  bookmarkId.value = ''
  selectedFolderId.value = ''
  try {
    const bookmarksRequest = fetch(api.blog.bookmarks, { headers: headers() })
    await loadFolders()
    const bookmarksRes = await bookmarksRequest
    if (!bookmarksRes.ok) throw new Error('加载收藏状态失败')
    const payload = await bookmarksRes.json()
    const bookmark = ((payload.data || []) as BookmarkRecord[]).find(item => item.post_id === targetPostId)
    bookmarkId.value = bookmark?.id || ''
    selectedFolderId.value = bookmark?.bookmark_folder_id || ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

const close = () => {
  show.value = false
  newFolderName.value = ''
}

const updateGlobalState = (saved: boolean) => {
  const next = new Set(feedStore.bookmarkedPostIds)
  if (saved) next.add(postId.value)
  else next.delete(postId.value)
  feedStore.bookmarkedPostIds = next
  emit('changed', { postId: postId.value, saved })
}

const saveToFolder = async (folderId: string) => {
  if (selectedFolderId.value === folderId && bookmarkId.value) {
    close()
    return
  }
  error.value = ''
  const res = await fetch(api.blog.bookmarks, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: postId.value, bookmark_folder_id: folderId }),
  })
  if (!res.ok) {
    error.value = '收藏失败'
    return
  }
  const payload = await res.json()
  bookmarkId.value = payload.data?.id || bookmarkId.value
  selectedFolderId.value = folderId
  updateGlobalState(true)
  close()
}

const createFolder = async () => {
  const name = newFolderName.value.trim()
  if (!name) return
  const res = await fetch(api.blog.bookmarkFolders, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    error.value = '新建收藏夹失败'
    return
  }
  const payload = await res.json()
  folders.value = [payload.data, ...folders.value]
  newFolderName.value = ''
}

const removeBookmark = async () => {
  if (!bookmarkId.value) return
  const res = await fetch(api.blog.bookmark(bookmarkId.value), { method: 'DELETE', headers: headers() })
  if (!res.ok) {
    error.value = '取消收藏失败'
    return
  }
  updateGlobalState(false)
  close()
}

defineExpose({ open })
</script>

<style scoped>
.bookmark-folder-modal { display: grid; gap: 0.55rem; }
.bookmark-folder-option { display: grid; grid-template-columns: 20px 1fr 20px; align-items: center; gap: 0.6rem; width: 100%; min-height: 2.75rem; padding: 0.55rem 0.7rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-fg); text-align: left; cursor: pointer; }
.bookmark-folder-option.active { border-color: var(--a-color-fg); font-weight: 800; }
.bookmark-folder-create { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; margin-top: 0.7rem; }
.bookmark-folder-create input { min-width: 0; border: 1px solid var(--a-color-border); padding: 0.55rem 0.65rem; background: var(--a-color-bg); color: var(--a-color-fg); }
</style>
