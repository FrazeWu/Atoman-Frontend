<template>
  <div class="a-page" style="padding-bottom:12rem">
    <PToast v-model="toastVisible" :message="toastMessage" />
    <div v-if="loading" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-skeleton" style="height:8rem" />
      <div class="a-skeleton" style="height:2rem;width:50%" />
    </div>

    <PEmpty v-else-if="!collection" text="合集不存在或已被删除" />

    <template v-else>
      <PPageHeader :title="collection.name" accent :sub="collection.description || ''" mb="1.5rem">
        <template #action>
          <div class="ui-actions-row">
            <PClip
              v-if="authStore.isAuthenticated && !isOwner"
              :disabled="collectionSubscribeLoading"
              @click="toggleCollectionSubscribe"
            >
              {{ collectionSubscribeLoading ? '处理中...' : (collectionSubscribed ? '已订阅' : '订阅合集') }}
            </PClip>
            <PClip
              data-testid="collection-rss"
              label="RSS"
              title="复制 RSS 订阅地址"
              @click="copyCollectionRssLink"
            />
            <PLink :href="`/posts/channel/${channelId}`" label="返回频道" />
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
          <p style="font-weight: 500;margin:0">{{ postsTotal }}篇</p>
        </div>
      </PCard>

      <section>
        <div class="section-headline">
          <PSectionHeader title="收录文章" rule />
          <span class="a-muted" style="font-size:.875rem">{{ postsTotal }} 篇</span>
        </div>

        <PEmpty v-if="!posts.length" text="当前合集暂无文章" />
        <div v-else class="post-list feed-timeline-box">
          <BlogItemCard
            v-for="post in posts"
            :key="post.id"
            :item="post"
            type="post"
            :bookmarked="starredIds.has(post.id)"
            :in-reading-list="readingListIds.has(post.id)"
            @click="blogSheets.openPost(post.id, post.title, collectionId)"
            @toggle-bookmark="toggleStar(post.id)"
            @toggle-reading-list="toggleReadingList(post.id)"
          />
        </div>
        <div v-if="postsHasMore" class="collection-load-more">
          <PButton variant="secondary" :loading="postsLoading" @click="loadMorePosts">加载更多</PButton>
        </div>
      </section>

      <!-- Edit Collection Modal -->
      <PModal v-model="editModalOpen" title="编辑合集">
        <div style="display:flex;flex-direction:column;gap:1rem">
          <PInput v-model="form.name" label="合集名称" placeholder="输入合集名称" />
          <PTextarea v-model="form.description" label="合集描述" placeholder="简短介绍这个合集" :rows="3" />
          <div class="modal-actions">
            <PButton label="取消" variant="secondary" @click="editModalOpen = false" />
            <PButton :disabled="!form.name.trim() || saving" :loading="saving" loading-text="保存中..." @click="saveCollection">
              更新
            </PButton>
          </div>
        </div>
      </PModal>

      <!-- Delete Confirmation Modal -->
      <PModal v-model="deleteModalOpen" title="确认删除合集">
        <div style="display:flex;flex-direction:column;gap:1rem">
          <p>确定要删除合集<strong>{{ collection.name }}</strong>吗？只能删除没有文章的合集。</p>
          <div class="modal-actions">
            <PButton label="取消" variant="secondary" @click="deleteModalOpen = false" />
            <PReject label="删除" @click="deleteCollection" />
          </div>
        </div>
      </PModal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PModal from '@/components/ui/PModal.vue'
import PCard from '@/components/ui/PCard.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PClip from '@/components/ui/PClip.vue'
import PToast from '@/components/ui/PToast.vue'
import PLink from '@/components/ui/PLink.vue'
import PButton from '@/components/ui/PButton.vue'
import PReject from '@/components/ui/PReject.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { Collection, Post, Channel } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useSheetStore } from '@/stores/sheet'
import { useBlogSheets } from '@/composables/useBlogSheets'

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const sheetStore = useSheetStore()
const blogSheets = useBlogSheets()

const loading = ref(true)
const collection = ref<Collection | null>(null)
const channel = ref<Channel | null>(null)
const posts = ref<Post[]>([])
const postsPage = ref(1)
const postsTotal = ref(0)
const postsHasMore = ref(false)
const postsLoading = ref(false)

const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const form = ref({ name: '', description: '' })
const saving = ref(false)
const collectionSubscribed = ref(false)
const collectionSubscribeLoading = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
let collectionRequestId = 0
let postsRequestId = 0

const collectionId = computed(() => props.id || (typeof route.params.id === 'string' ? route.params.id : ''))
const collectionRssUrl = computed(() => collectionId.value ? api.rss.collection(collectionId.value) : '')
const channelId = computed(() => collection.value?.channel_id || '')
const authHeader = computed<Record<string, string>>(() => {
  const headers: Record<string, string> = {}
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
  return headers
})

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

function copyCollectionRssLink() {
  if (!collectionRssUrl.value) return
  void navigator.clipboard.writeText(collectionRssUrl.value).then(() => {
    toastMessage.value = '已复制 RSS 链接'
    toastVisible.value = true
  })
}

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
  const requestId = ++collectionRequestId
  postsRequestId++
  const requestedCollectionId = collectionId.value
  loading.value = true
  postsLoading.value = false
  collection.value = null
  channel.value = null
  collectionSubscribed.value = false
  collectionSubscribeLoading.value = false
  posts.value = []
  postsPage.value = 1
  postsTotal.value = 0
  postsHasMore.value = false
  try {
    const res = await apiRequestResult(api.blog.collection(requestedCollectionId))
    if (requestId !== collectionRequestId || requestedCollectionId !== collectionId.value) return
    if (res.ok) {
      const data = await Promise.resolve(res.data)
      if (requestId !== collectionRequestId || requestedCollectionId !== collectionId.value) return
      collection.value = data.data
      if (collection.value?.channel_id) {
        await Promise.all([fetchChannel(requestId, collection.value.channel_id), fetchPosts()])
      }

      if (requestId !== collectionRequestId || requestedCollectionId !== collectionId.value) return
      if (authStore.isAuthenticated && collection.value?.id) {
        collectionSubscribeLoading.value = true
        const subscribed = await feedStore.isSubscribedToCollection(collection.value.id)
        if (requestId !== collectionRequestId || requestedCollectionId !== collectionId.value) return
        collectionSubscribed.value = subscribed
        collectionSubscribeLoading.value = false
      }

      if (props.id && collection.value) {
        sheetStore.updateSheetTitle(props.id, 'collection', collection.value.name)
      }
    }
  } catch (e) {
    reportError(e, 'Failed to fetch collection:')
  } finally {
    if (requestId === collectionRequestId) loading.value = false
  }
}

watch(collectionId, () => {
  void fetchCollection()
})

const fetchChannel = async (requestId: number, requestedChannelId: string) => {
  if (!requestedChannelId) return
  try {
    const res = await apiRequestResult(api.blog.channel(requestedChannelId))
    if (requestId !== collectionRequestId || !res.ok) return
    const data = await Promise.resolve(res.data)
    if (requestId === collectionRequestId) channel.value = data.data
  } catch (e) {
    reportError(e, 'Failed to fetch channel:')
  }
}

const fetchPosts = async (page = 1, append = false) => {
  if (!collectionId.value || (append && postsLoading.value)) return
  const requestedCollectionId = collectionId.value
  const requestId = ++postsRequestId
  postsLoading.value = true
  try {
    const params = new URLSearchParams({
      collection_id: requestedCollectionId,
      page_size: '20',
      page: String(page),
    })
    const res = await apiRequestResult(`${api.blog.posts}?${params}`, { headers: authHeader.value })
    if (requestId !== postsRequestId || requestedCollectionId !== collectionId.value || !res.ok) {
      if (!res.ok) throw new Error(`Failed to fetch collection posts (${res.status})`)
      return
    }
    const data = await Promise.resolve(res.data)
    if (requestId !== postsRequestId || requestedCollectionId !== collectionId.value) return
    const nextPosts = (data.data || []) as Post[]
    posts.value = append ? [...posts.value, ...nextPosts] : nextPosts
    postsPage.value = page
    postsTotal.value = Number(data.meta?.total ?? posts.value.length)
    postsHasMore.value = Boolean(data.meta?.has_more)
  } catch (e) {
    reportError(e, 'Failed to fetch posts:')
  } finally {
    if (requestId === postsRequestId) postsLoading.value = false
  }
}

const loadMorePosts = () => {
  if (!postsHasMore.value || postsLoading.value) return
  void fetchPosts(postsPage.value + 1, true)
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
    const res = await apiRequestResult(api.blog.collection(collection.value.id), {
      method: 'PUT',
      headers: { ...authHeader.value, 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    if (!res.ok) return
    editModalOpen.value = false
    await fetchCollection()
  } catch (e) {
    reportError(e, 'Failed to save collection:')
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
    const res = await apiRequestResult(api.blog.collection(collection.value.id), {
      method: 'DELETE',
      headers: authHeader.value
    })
    if (!res.ok) return
    deleteModalOpen.value = false
    router.push(`/posts/channel/${channelId.value}`)
  } catch (e) {
    reportError(e, 'Failed to delete collection:')
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
    reportError(e, 'Failed to toggle collection subscription:')
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
.ui-actions-row,
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

.collection-load-more {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.post-list.feed-timeline-box {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  background: var(--a-color-bg);
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
