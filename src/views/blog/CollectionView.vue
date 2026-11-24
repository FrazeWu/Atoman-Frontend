<template>
  <div class="collection-view">
    <PToast v-model="toastVisible" :message="toastMessage" />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="collection-skeleton-wrap">
      <div class="a-skeleton collection-skeleton-header" />
      <div class="collection-divider" />
      <div class="collection-skeleton-list">
        <div v-for="i in 3" :key="i" class="a-skeleton collection-skeleton-item" />
      </div>
    </div>

    <!-- Error State -->
    <PEmpty v-else-if="loadError" title="合集加载失败" :description="loadError">
      <template #action>
        <PButton variant="secondary" size="sm" @click="fetchCollection">重试</PButton>
      </template>
    </PEmpty>

    <!-- Missing State -->
    <PEmpty v-else-if="!collection" title="合集不存在" description="该专栏合集不存在或已被作者删除" />

    <!-- Content State -->
    <template v-else>
      <!-- Top Area: Name, Description, Actions & Meta (No box borders) -->
      <header class="collection-header">
        <div class="collection-header-top">
          <div class="collection-title-wrap">
            <h1 class="collection-title">{{ collection.name }}</h1>
            <p v-if="collection.description" class="collection-description">
              {{ collection.description }}
            </p>
          </div>

          <div class="collection-actions">
            <!-- Primary Action: Subscribe (Single Blue Button Rule with Fixed Width to prevent jumping) -->
            <PButton
              v-if="authStore.isAuthenticated && !isOwner && !collectionSubscribed"
              variant="primary"
              size="sm"
              class="subscribe-btn-fixed"
              :disabled="collectionSubscribeLoading"
              :loading="collectionSubscribeLoading"
              loading-text="订阅中..."
              @click="toggleCollectionSubscribe"
            >
              <Plus :size="14" class="button-icon" />
              <span>订阅合集</span>
            </PButton>

            <PButton
              v-else-if="authStore.isAuthenticated && !isOwner && collectionSubscribed"
              variant="secondary"
              size="sm"
              class="subscribe-btn-fixed"
              :disabled="collectionSubscribeLoading"
              :loading="collectionSubscribeLoading"
              loading-text="取消中..."
              @click="toggleCollectionSubscribe"
            >
              <Check :size="14" class="button-icon" />
              <span>已订阅</span>
            </PButton>

            <!-- Owner Actions -->
            <template v-if="isOwner">
              <PButton variant="secondary" size="sm" @click="openEditModal">
                <Pencil :size="14" class="button-icon" />
                <span>编辑</span>
              </PButton>
              <PButton
                v-if="postsTotal === 0"
                variant="secondary"
                size="sm"
                @click="confirmDelete"
              >
                <Trash2 :size="14" class="button-icon" />
                <span>删除</span>
              </PButton>
            </template>

            <!-- RSS Button -->
            <PButton
              data-testid="collection-rss"
              variant="secondary"
              size="sm"
              title="复制 RSS 订阅地址"
              @click="copyCollectionRssLink"
            >
              <Rss :size="14" class="button-icon" />
              <span>RSS</span>
            </PButton>

            <!-- Back to Channel -->
            <PButton
              v-if="channelId"
              variant="secondary"
              size="sm"
              :to="`/posts/channel/${channelId}`"
            >
              <ArrowLeft :size="14" class="button-icon" />
              <span>频道主页</span>
            </PButton>
          </div>
        </div>

        <!-- Meta Line: Channel, Post Count, Updated Time (Pure typographic line, no enclosed box) -->
        <div class="collection-meta-line">
          <span v-if="channelId" class="meta-item channel-item">
            <span class="meta-label">频道：</span>
            <PLink :to="`/posts/channel/${channelId}`" class="channel-clickable-pill">
              <span>{{ channel?.name || '主频道' }}</span>
              <ArrowUpRight :size="12" class="link-arrow" />
            </PLink>
          </span>
          <span class="meta-dot">·</span>
          <span class="meta-item">{{ postsTotal }} 篇文章</span>
          <span class="meta-dot">·</span>
          <span class="meta-item">{{ formatUpdatedDate(collection.updated_at || collection.created_at) }} 更新</span>
        </div>
      </header>

      <!-- Horizontal Divider Line -->
      <div class="collection-divider" />

      <!-- Bottom Area: ONLY Posts List -->
      <section class="collection-posts-section">
        <PEmpty v-if="postsError" title="文章加载失败" :description="postsError">
          <template #action>
            <PButton variant="secondary" size="sm" @click="fetchPosts(1, false)">重试</PButton>
          </template>
        </PEmpty>
        <PEmpty v-else-if="!posts.length" title="暂无收录文章" description="当前专栏合集尚未收录任何文章" />
        <div v-else class="collection-posts-list">
          <div
            v-for="(post, index) in posts"
            :key="post.id"
            class="collection-post-row"
          >
            <div class="collection-sequence-index" :title="`第 ${index + 1} 篇`">
              {{ String(index + 1).padStart(2, '0') }}
            </div>
            <div class="collection-post-card-wrap">
              <BlogItemCard
                :item="post"
                type="post"
                :bookmarked="starredIds.has(post.id)"
                :in-reading-list="readingListIds.has(post.id)"
                @click="blogSheets.openPost(post.id, post.title, collectionId)"
                @toggle-bookmark="toggleStar(post.id)"
                @toggle-reading-list="toggleReadingList(post.id)"
              >
                <template #meta-extra>
                  <span class="collection-issue-pill">第 {{ String(index + 1).padStart(2, '0') }} 期</span>
                </template>
              </BlogItemCard>
            </div>
          </div>
        </div>

        <div v-if="postsHasMore" class="collection-load-more">
          <PButton variant="secondary" size="sm" :loading="postsLoading" @click="loadMorePosts">
            加载更多文章
          </PButton>
        </div>
      </section>

      <!-- Edit Collection Modal -->
      <PModal v-model="editModalOpen" title="编辑合集">
        <div class="collection-modal-body">
          <PInput v-model="form.name" label="合集名称" placeholder="输入合集名称" />
          <PTextarea v-model="form.description" label="合集描述" placeholder="简短介绍这个合集" :rows="3" />
          <div class="modal-actions">
            <PButton label="取消" variant="secondary" size="sm" @click="editModalOpen = false" />
            <div class="modal-submit-wrap">
              <PButton
                variant="primary"
                size="sm"
                :disabled="!form.name.trim() || saving"
                :loading="saving"
                loading-text="保存中..."
                @click="saveCollection"
              >
                更新
              </PButton>
              <PActionFeedback v-if="actionType === 'save'" :message="actionError" />
            </div>
          </div>
        </div>
      </PModal>

      <!-- Delete Confirmation Modal -->
      <PModal v-model="deleteModalOpen" title="确认删除合集">
        <div class="collection-modal-body">
          <p class="delete-prompt">确定要删除合集<strong>《{{ collection.name }}》</strong>吗？只能删除没有文章的合集。</p>
          <div class="modal-actions">
            <PButton label="取消" variant="secondary" size="sm" @click="deleteModalOpen = false" />
            <div class="modal-submit-wrap">
              <PButton
                variant="danger"
                size="sm"
                :loading="saving"
                loading-text="删除中..."
                @click="deleteCollection"
              >
                删除合集
              </PButton>
              <PActionFeedback v-if="actionType === 'delete'" :message="actionError" />
            </div>
          </div>
        </div>
      </PModal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { errorMessage, reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Pencil,
  Plus,
  Rss,
  Trash2,
} from 'lucide-vue-next'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PToast from '@/components/ui/PToast.vue'
import PLink from '@/components/ui/PLink.vue'
import PButton from '@/components/ui/PButton.vue'
import PActionFeedback from '@/components/ui/PActionFeedback.vue'
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
const loadError = ref('')
const postsError = ref('')
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
const actionError = ref('')
const actionType = ref<'subscribe' | 'save' | 'delete' | ''>('')
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

async function copyCollectionRssLink() {
  if (!collectionRssUrl.value) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(collectionRssUrl.value)
    toastMessage.value = '已复制 RSS 订阅源地址'
  } catch {
    toastMessage.value = '复制失败，请手动复制 RSS 链接'
  } finally {
    toastVisible.value = true
  }
}

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const isOwner = computed(() => {
  if (!collection.value) return false
  return channel.value?.user_id === authStore.user?.uuid
})

const formatUpdatedDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`

  const month = d.getMonth() + 1
  const day = d.getDate()
  const year = d.getFullYear()
  return year === now.getFullYear() ? `${month}月${day}日` : `${year}年${month}月${day}日`
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
  loadError.value = ''
  postsError.value = ''
  try {
    const res = await apiRequestResult(api.blog.collection(requestedCollectionId))
    if (requestId !== collectionRequestId || requestedCollectionId !== collectionId.value) return
    if (res.ok) {
      const data = await Promise.resolve(res.data)
      if (requestId !== collectionRequestId || requestedCollectionId !== collectionId.value) return
      const raw = (data.data || {}) as any
      collection.value = {
        id: raw.id || raw.ID || requestedCollectionId,
        channel_id: raw.channel_id || raw.ChannelID || '',
        channel: raw.channel || raw.Channel,
        name: raw.name || raw.Name || '',
        description: raw.description || raw.Description || '',
        cover_url: raw.cover_url || raw.CoverURL || '',
        is_default: raw.is_default ?? raw.IsDefault ?? false,
        created_at: raw.created_at || raw.CreatedAt || '',
        updated_at: raw.updated_at || raw.UpdatedAt || '',
      }

      if (raw.channel || raw.Channel) {
        channel.value = raw.channel || raw.Channel
      }

      if (collection.value?.channel_id) {
        await Promise.all([
          channel.value ? Promise.resolve() : fetchChannel(requestId, collection.value.channel_id),
          fetchPosts(1, false)
        ])
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
        blogSheets.updateLayerTitle(`collection:${props.id}`, collection.value.name)
      }
    } else if (res.status !== 404) {
      loadError.value = '合集加载失败，请重试'
    }
  } catch (e) {
    if (requestId === collectionRequestId) loadError.value = '合集加载失败，请重试'
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
  postsError.value = ''
  postsLoading.value = true
  try {
    const params = new URLSearchParams({
      collection_id: requestedCollectionId,
      view: 'summary',
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
    if (requestId === postsRequestId && requestedCollectionId === collectionId.value) postsError.value = '合集文章加载失败，请重试'
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
  actionType.value = 'save'
  actionError.value = ''
  try {
    const res = await apiRequestResult(api.blog.collection(collection.value.id), {
      method: 'PUT',
      headers: { ...authHeader.value, 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    if (!res.ok) throw new Error('合集保存失败，请重试')
    editModalOpen.value = false
    await fetchCollection()
  } catch (e) {
    reportError(e, 'Failed to save collection:')
    actionError.value = errorMessage(e, '合集保存失败，请重试')
  } finally {
    saving.value = false
  }
}

const confirmDelete = () => {
  deleteModalOpen.value = true
}

const deleteCollection = async () => {
  if (!collection.value) return

  saving.value = true
  actionType.value = 'delete'
  actionError.value = ''
  try {
    const res = await apiRequestResult(api.blog.collection(collection.value.id), {
      method: 'DELETE',
      headers: authHeader.value
    })
    if (!res.ok) throw new Error('合集删除失败，请重试')
    deleteModalOpen.value = false
    router.push(`/posts/channel/${channelId.value}`)
  } catch (e) {
    reportError(e, 'Failed to delete collection:')
    actionError.value = errorMessage(e, '合集删除失败，请重试')
  } finally {
    saving.value = false
  }
}

const toggleCollectionSubscribe = async () => {
  if (!collection.value) return
  collectionSubscribeLoading.value = true
  actionType.value = 'subscribe'
  actionError.value = ''
  try {
    let success = false
    if (collectionSubscribed.value) {
      success = await feedStore.unsubscribeFromCollection(collection.value.id)
    } else {
      success = await feedStore.subscribeToCollection(collection.value.id)
    }

    if (success) {
      collectionSubscribed.value = !collectionSubscribed.value
    } else {
      actionError.value = '合集订阅状态更新失败，请重试'
    }
  } catch (e) {
    reportError(e, 'Failed to toggle collection subscription:')
    actionError.value = errorMessage(e, '合集订阅状态更新失败，请重试')
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
.collection-header {
  padding-bottom: 1.125rem;
}

.collection-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.collection-title-wrap {
  flex: 1;
  min-width: 0;
}

.collection-title {
  margin: 0 0 0.5rem;
  font-size: 1.625rem;
  font-weight: 600;
  color: var(--a-text-primary);
  line-height: 1.25;
  letter-spacing: -0.015em;
}

.collection-description {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--a-text-secondary);
  line-height: 1.6;
}

.collection-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* 核心防跳动：固定订阅按钮宽度，确保订阅前/后/加载中文案切换时绝对不跳动 */
.subscribe-btn-fixed {
  min-width: 5.75rem;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}

.button-icon {
  flex-shrink: 0;
}

.collection-meta-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--a-text-muted);
}

.channel-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-label {
  color: var(--a-text-muted);
}

/* 频道可点击药丸标签：醒目的主色调、微背景底色、微边框与箭头图标 */
.channel-clickable-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background-color: var(--a-color-primary-soft, rgba(59, 130, 246, 0.08));
  color: var(--a-color-primary, #2563eb);
  border: 1px solid var(--a-color-primary-border, rgba(59, 130, 246, 0.25));
  border-radius: var(--a-radius-control, 4px);
  font-weight: 500;
  font-size: 0.8125rem;
  text-decoration: none;
  line-height: 1.35;
  transition: all 0.15s ease;
}

.channel-clickable-pill:hover {
  background-color: var(--a-color-primary-hover-soft, rgba(59, 130, 246, 0.16));
  border-color: var(--a-color-primary, #2563eb);
  color: var(--a-color-primary-active, #1d4ed8);
}

.link-arrow {
  opacity: 0.8;
  transition: transform 0.15s ease;
}

.channel-clickable-pill:hover .link-arrow {
  opacity: 1;
  transform: translate(1px, -1px);
}

.meta-dot {
  color: var(--a-text-muted);
  opacity: 0.6;
}

/* 核心：去掉边框，下方加一条横线 */
.collection-divider {
  width: 100%;
  height: 1px;
  background-color: var(--a-color-border-soft, #f0f0f0);
  margin-bottom: 1.75rem;
}

.collection-posts-section {
  display: flex;
  flex-direction: column;
}

.collection-posts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 核心：01 02 等序号垂直绝对居中对齐右侧卡片 */
.collection-post-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.collection-sequence-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-top: 0;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-bg-surface-raised, var(--a-bg-surface));
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  font-family: var(--a-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-text-muted);
  flex-shrink: 0;
  user-select: none;
  line-height: 1;
}

.collection-post-card-wrap {
  flex: 1;
  min-width: 0;
}

.collection-issue-pill {
  font-size: 0.6875rem;
  padding: 0.125rem 0.375rem;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-bg-canvas);
  color: var(--a-text-secondary);
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  font-weight: 500;
}

.collection-load-more {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.collection-skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.collection-skeleton-header {
  height: 4.5rem;
  border-radius: var(--a-radius-card, 4px);
}

.collection-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.collection-skeleton-item {
  height: 6rem;
  border-radius: var(--a-radius-card, 4px);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.modal-submit-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
}

.collection-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.delete-prompt {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--a-text-secondary);
  line-height: 1.5;
}

.delete-prompt strong {
  color: var(--a-text-primary);
}

@media (max-width: 640px) {
  .collection-header-top {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .collection-actions {
    justify-content: flex-start;
  }

  .collection-title {
    font-size: 1.375rem;
  }

  .collection-post-row {
    gap: 0.5rem;
  }

  .collection-sequence-index {
    width: 1.75rem;
    height: 1.75rem;
    font-size: 0.75rem;
  }
}
</style>
