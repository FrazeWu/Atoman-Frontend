<template>
  <div class="a-page" style="padding-bottom:12rem">
    <div v-if="loading" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-skeleton" style="height:8rem" />
      <div class="a-skeleton" style="height:2rem;width:50%" />
    </div>

    <PEmpty v-else-if="!collection" text="合集不存在或已被删除" />

    <template v-else>
      <PPageHeader :title="collection.name" accent :sub="collection.description || ''" style="margin-bottom:2.5rem">
        <template #action>
          <div class="paper-actions-row">
            <PClip
              v-if="authStore.isAuthenticated && !isOwner"
              :disabled="collectionSubscribeLoading"
              @click="toggleCollectionSubscribe"
            >
              {{ collectionSubscribeLoading ? '处理中...' : (collectionSubscribed ? '已订阅' : '订阅合集') }}
            </PClip>
            <PLink :href="`/posts/channel/${channelId}`" label="返回频道" />
            <PLink
              v-if="isOwner"
              :href="`/posts/post/new?channel=${channelId}&collection=${collection.id}`"
              label="写文章"
            />
          </div>
        </template>
      </PPageHeader>

      <PCard class="collection-meta-card">
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">所属频道</p>
          <PLink :href="`/posts/channel/${channelId}`">
            {{ channel?.name || '加载中...' }}
          </PLink>
        </div>
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">文章数量</p>
          <p style="font-weight: 500;margin:0">{{ posts.length }}篇</p>
        </div>
        <div v-if="isOwner" class="paper-actions-row">
          <PClip label="编辑" @click="openEditModal" />
          <PReject label="删除" @click="confirmDelete" />
        </div>
      </PCard>

      <section>
        <div class="section-headline">
          <PSectionHeader title="收录文章" rule />
          <span class="a-muted" style="font-size:.875rem">{{ posts.length }} 篇</span>
        </div>

        <PEmpty v-if="!posts.length" text="当前合集暂无文章" />
        <div v-else class="post-list">
          <PEntry
            v-for="post in posts"
            :key="post.id"
            :title="post.title"
            :summary="post.summary || summarize(post.content)"
            @click="$router.push(`/posts/post/${post.id}`)"
          >
            <template #meta>
              <span v-if="post.status !== 'published'" class="a-badge" style="margin-right:0.5rem">草稿</span>
              <span>{{ formatDate(post.updated_at) }}</span>
            </template>
            <template #actions>
              <div style="display:flex;gap:.75rem;align-items:center">
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
                <PLink :href="`/posts/post/${post.id}`" label="查看" />
                <PLink
                  v-if="isOwner"
                  :href="`/posts/post/${post.id}/edit?channel=${channelId}`"
                  label="编辑"
                />
              </div>
            </template>
          </PEntry>
        </div>
      </section>

      <!-- Edit Collection Modal -->
      <PModal v-model="editModalOpen" title="编辑合集">
        <div style="display:flex;flex-direction:column;gap:1rem">
          <PInput v-model="form.name" label="合集名称" placeholder="输入合集名称" />
          <PTextarea v-model="form.description" label="合集描述" placeholder="简短介绍这个合集" :rows="3" />
          <div class="modal-actions">
            <PPress label="取消" variant="secondary" @click="editModalOpen = false" />
            <PPress :disabled="!form.name.trim() || saving" :loading="saving" loading-text="保存中..." @click="saveCollection">
              更新
            </PPress>
          </div>
        </div>
      </PModal>

      <!-- Delete Confirmation Modal -->
      <PModal v-model="deleteModalOpen" title="确认删除合集">
        <div style="display:flex;flex-direction:column;gap:1rem">
          <p>确定要删除合集<strong>{{ collection.name }}</strong>吗？此操作不可恢复，但不会删除其中的文章。</p>
          <div class="modal-actions">
            <PPress label="取消" variant="secondary" @click="deleteModalOpen = false" />
            <PReject label="删除" @click="deleteCollection" />
          </div>
        </div>
      </PModal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PModal from '@/components/ui/PModal.vue'
import PCard from '@/components/ui/PCard.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PClip from '@/components/ui/PClip.vue'
import PLink from '@/components/ui/PLink.vue'
import PPress from '@/components/ui/PPress.vue'
import PReject from '@/components/ui/PReject.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { Collection, Post, Channel } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useSheetStore } from '@/stores/sheet'

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const sheetStore = useSheetStore()

const loading = ref(true)
const collection = ref<Collection | null>(null)
const channel = ref<Channel | null>(null)
const posts = ref<Post[]>([])

const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const form = ref({ name: '', description: '' })
const saving = ref(false)
const collectionSubscribed = ref(false)
const collectionSubscribeLoading = ref(false)

const collectionId = computed(() => props.id || (typeof route.params.id === 'string' ? route.params.id : ''))
const channelId = computed(() => collection.value?.channel_id || '')
const authHeader = computed(() => ({ Authorization: `Bearer ${authStore.token}` }))

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const isOwner = computed(() => {
  if (!collection.value) return false
  // Check ownership through channel since collections belong to channels
  return channel.value?.user_id === authStore.user?.uuid
})

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  
  const month = d.getMonth() + 1
  const day = d.getDate()
  const year = d.getFullYear()
  return year === now.getFullYear() ? `${month}/${day}` : `${year}/${month}/${day}`
}

const summarize = (content: string) => {
  const text = content.replace(/[#*_~`]/g, '').replace(/\n/g, ' ')
  return text.length > 120 ? text.slice(0, 120) + '...' : text
}

const fetchCollection = async () => {
  loading.value = true
  try {
    const res = await fetch(api.blog.collection(collectionId.value))
    if (res.ok) {
      const data = await res.json()
      collection.value = data.data
      if (collection.value?.channel_id) {
        await fetchChannel()
        await fetchPosts()
      }

      if (authStore.isAuthenticated && collection.value?.id) {
        collectionSubscribeLoading.value = true
        collectionSubscribed.value = await feedStore.isSubscribedToCollection(collection.value.id)
        collectionSubscribeLoading.value = false
      }

      if (props.id && collection.value) {
        sheetStore.updateSheetTitle(props.id, 'collection', collection.value.name)
      }
    }
  } catch (e) {
    console.error('Failed to fetch collection:', e)
  } finally {
    loading.value = false
  }
}

watch(collectionId, () => {
  fetchCollection()
})

const fetchChannel = async () => {
  if (!channelId.value) return
  try {
    const res = await fetch(api.blog.channel(channelId.value))
    if (res.ok) {
      const data = await res.json()
      channel.value = data.data
    }
  } catch (e) {
    console.error('Failed to fetch channel:', e)
  }
}

const fetchPosts = async () => {
  if (!channelId.value) return
  try {
    const res = await fetch(`${api.blog.posts}?channel_id=${channelId.value}&limit=100`)
    if (res.ok) {
      const data = await res.json()
      const allPosts = (data.data || []) as Post[]
      posts.value = allPosts.filter(post => 
        (post.collections || []).some(c => c.id === collectionId.value)
      )
    }
  } catch (e) {
    console.error('Failed to fetch posts:', e)
  }
}

const openEditModal = () => {
  form.value = {
    name: collection.value?.name || '',
    description: collection.value?.description || ''
  }
  editModalOpen.value = true
}

const saveCollection = async () => {
  if (!form.value.name.trim() || !collection.value) return
  
  saving.value = true
  try {
    await fetch(api.blog.collection(collection.value.id), {
      method: 'PUT',
      headers: { ...authHeader.value, 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    editModalOpen.value = false
    await fetchCollection()
  } catch (e) {
    console.error('Failed to save collection:', e)
  } finally {
    saving.value = false
  }
}

const confirmDelete = () => {
  deleteModalOpen.value = true
}

const deleteCollection = async () => {
  if (!collection.value) return
  
  try {
    await fetch(api.blog.collection(collection.value.id), {
      method: 'DELETE',
      headers: authHeader.value
    })
    deleteModalOpen.value = false
    router.push(`/posts/channel/${channelId.value}`)
  } catch (e) {
    console.error('Failed to delete collection:', e)
  }
}

const toggleCollectionSubscribe = async () => {
  if (!collection.value) return
  collectionSubscribeLoading.value = true
  try {
    let success = false
    if (collectionSubscribed.value) {
      success = await feedStore.unsubscribeFromCollection(collection.value.id)
    } else {
      success = await feedStore.subscribeToCollection(collection.value.id)
    }

    if (success) {
      collectionSubscribed.value = !collectionSubscribed.value
    }
  } catch (e) {
    console.error('Failed to toggle collection subscription:', e)
  } finally {
    collectionSubscribeLoading.value = false
  }
}

onMounted(() => {
  void fetchCollection()
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
})
</script>

<style scoped>
.paper-actions-row,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.collection-meta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2.5rem;
}

.section-headline {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
</style>
