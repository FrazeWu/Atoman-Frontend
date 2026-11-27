<template>
  <div class="a-page-xl channel-view-page">
    <PToast v-model="toastVisible" :message="toastMessage" />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="channel-skeleton-wrap">
      <div class="a-skeleton channel-skeleton-header" />
      <div class="channel-divider" />
      <div class="channel-skeleton-list">
        <div v-for="i in 3" :key="i" class="a-skeleton channel-skeleton-item" />
      </div>
    </div>

    <!-- Error State -->
    <PEmpty v-else-if="loadError" title="加载失败" :description="loadError">
      <template #action>
        <PButton variant="secondary" size="sm" @click="loadChannel">重试</PButton>
      </template>
    </PEmpty>

    <!-- Missing State -->
    <PEmpty v-else-if="!channel" title="频道不存在" description="该频道已被删除或链接无效" />

    <!-- Content State -->
    <template v-else>
      <CreatorThemeScope :creator-id="channel.user?.uuid || channel.user_id" :preset-config="activeTheme?.preset_config">
        <!-- Top Area: Name, Description, Author, Actions (No enclosed box, pure typography) -->
        <header class="channel-header">
          <div class="channel-header-top">
            <div class="channel-title-wrap">
              <h1 class="channel-title">{{ channel.name }}</h1>
              <p v-if="channel.description" class="channel-description">
                {{ channel.description }}
              </p>
            </div>

            <div class="channel-actions">
              <!-- Primary Action: Subscribe (Single Blue Button Rule with Fixed Width to prevent jumping) -->
              <PButton
                v-if="authStore.isAuthenticated && !isOwner && !channelSubscribed"
                variant="primary"
                size="sm"
                class="subscribe-btn-fixed"
                :disabled="channelSubscribeLoading"
                :loading="channelSubscribeLoading"
                loading-text="订阅中..."
                @click="toggleChannelSubscribe"
              >
                <Plus :size="14" class="button-icon" />
                <span>订阅频道</span>
              </PButton>

              <PButton
                v-else-if="authStore.isAuthenticated && !isOwner && channelSubscribed"
                variant="secondary"
                size="sm"
                class="subscribe-btn-fixed"
                :disabled="channelSubscribeLoading"
                :loading="channelSubscribeLoading"
                loading-text="取消中..."
                @click="toggleChannelSubscribe"
              >
                <Check :size="14" class="button-icon" />
                <span>已订阅</span>
              </PButton>

              <!-- Message Channel -->
              <PButton
                v-if="authStore.isAuthenticated && !isOwner"
                data-testid="message-channel"
                :to="{ path: '/inbox', query: { tab: 'dm', target_type: 'channel', target_id: channel.id } }"
                size="sm"
                variant="secondary"
              >
                <MessageSquare :size="14" class="button-icon" />
                <span>私信</span>
              </PButton>

              <!-- RSS Button -->
              <PButton
                v-if="channelRssUrl"
                data-testid="channel-rss"
                variant="secondary"
                size="sm"
                title="复制 RSS 订阅地址"
                @click="copyRssLink"
              >
                <Rss :size="14" class="button-icon" />
                <span>RSS</span>
              </PButton>
            </div>
          </div>

          <!-- Author and Meta line: pure typography, no box border -->
          <div class="channel-meta-line">
            <div class="channel-author-info">
              <PAvatar
                :src="channel.user?.avatar_url"
                :name="channel.user?.display_name || channel.user?.username || '未知作者'"
                :alt="`${channel.user?.display_name || channel.user?.username || '未知作者'} 的头像`"
                size="xs"
              />
              <a
                v-if="channel.user?.username"
                :href="userUrl(channel.user.username)"
                class="channel-author-link"
              >
                {{ channel.user.display_name || channel.user.username }}
                <span class="author-handle">@{{ channel.user.username }}</span>
              </a>
              <span v-else class="channel-author-link">未知作者</span>
            </div>
            <span class="meta-dot">·</span>
            <span class="meta-item">{{ postsTotal }} 篇文章</span>
            <span class="meta-dot">·</span>
            <span class="meta-item">{{ formatDate(channel.updated_at) }} 更新</span>
          </div>
        </header>

        <!-- Horizontal Divider Line -->
        <div class="channel-divider" />

        <!-- Bottom Area: ONLY Posts List -->
        <section class="channel-posts-section">
          <PEmpty v-if="!postsLoading && !filteredPosts.length" title="暂无内容" description="当前频道还没有发表文章" />
          <div v-else class="channel-posts-list">
            <BlogItemCard
              v-for="post in filteredPosts"
              :key="post.id"
              :item="post"
              type="post"
              :bookmarked="starredIds.has(post.id)"
              :in-reading-list="readingListIds.has(post.id)"
              @click="blogSheets.openPost(post.id, post.title, activeCollectionId || undefined)"
              @toggle-bookmark="toggleStar(post.id)"
              @toggle-reading-list="toggleReadingList(post.id)"
            />
          </div>
          <div v-if="postsHasMore" class="channel-load-more">
            <PButton variant="secondary" size="sm" :loading="postsLoading" @click="loadMorePosts">
              加载更多文章
            </PButton>
          </div>
        </section>
      </CreatorThemeScope>
    </template>

    <!-- Collection Modal -->
    <PModal v-if="collectionModalOpen" @close="collectionModalOpen = false">
      <h3 class="a-subtitle" style="margin-bottom:1.5rem">{{ editingCollection ? '编辑合集' : '新建合集' }}</h3>
      <div style="display:flex;flex-direction:column;gap:1rem">
        <PInput v-model="collectionForm.name" placeholder="合集名称*" />
        <PTextarea v-model="collectionForm.description" placeholder="合集描述（可选）" :rows="3" />
      </div>
      <div class="modal-actions">
        <PButton label="取消" variant="secondary" size="sm" @click="collectionModalOpen = false" />
        <div class="collection-action">
          <PButton :disabled="!collectionForm.name.trim() || collectionSaving" :loading="collectionSaving" loading-text="保存中..." size="sm" @click="saveCollection">
            {{ editingCollection ? '更新' : '创建' }}
          </PButton>
          <PActionFeedback :message="collectionActionError" />
        </div>
      </div>
    </PModal>

    <!-- 创作者装扮入口与定制抽屉 -->
    <Teleport to="body">
      <button
        v-if="isOwner"
        class="theme-customize-launcher"
        title="装扮空间"
        @click="isThemeDrawerOpen = true"
      >
        <Palette :size="14" aria-hidden="true" />
        <span>装扮空间</span>
      </button>
    </Teleport>

    <ThemeCustomizerDrawer
      v-if="isOwner && channel && (channel.user?.uuid || channel.user_id)"
      v-model:open="isThemeDrawerOpen"
      :creator-id="channel.user?.uuid || channel.user_id"
      :creator-handle="channel.user?.username"
      :initial-theme="activeTheme"
    />

    <ThemeEscapeHatch v-if="!isOwner" />
  </div>
</template>

<script setup lang="ts">
import { errorMessage, reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Check, MessageSquare, Palette, Plus, Rss } from 'lucide-vue-next'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { Channel, Collection, Post } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useCreatorTheme } from '@/composables/useCreatorTheme'
import ThemeCustomizerDrawer from '@/components/theme/ThemeCustomizerDrawer.vue'
import CreatorThemeScope from '@/components/theme/CreatorThemeScope.vue'
import ThemeEscapeHatch from '@/components/theme/ThemeEscapeHatch.vue'
import PToast from '@/components/ui/PToast.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PActionFeedback from '@/components/ui/PActionFeedback.vue'
import { resolveSiteContext } from '@/router/siteContext'
import { userUrl } from '@/composables/useSubdomainNav'
import { useBlogSheets } from '@/composables/useBlogSheets'

const props = defineProps<{ entityHandle?: string }>()
const route = useRoute()
const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const blogSheets = useBlogSheets()

const { activeTheme, loadCreatorTheme } = useCreatorTheme()
const isThemeDrawerOpen = ref(false)

const loading = ref(true)
const loadError = ref('')
const channel = ref<Channel | null>(null)
const collections = ref<Collection[]>([])
const channelPosts = ref<Post[]>([])
const activeCollectionId = ref<string | null>(null)
const postsPage = ref(1)
const postsTotal = ref(0)
const postsHasMore = ref(false)
const postsLoading = ref(false)

const collectionModalOpen = ref(false)
const editingCollection = ref<Collection | null>(null)
const collectionForm = ref({ name: '', description: '' })
const collectionSaving = ref(false)
const collectionActionError = ref('')

const channelSubscribed = ref(false)
const channelSubscribeLoading = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
let loadGeneration = 0
let postsRequestId = 0

const siteContext = computed(() => resolveSiteContext(window.location.hostname, window.location.search, window.location.pathname))
const routeParam = computed(() => {
  if (props.entityHandle) return props.entityHandle
  if (siteContext.value.type === 'entity') return siteContext.value.handle
  return typeof route.params.slug === 'string' ? route.params.slug : typeof route.params.id === 'string' ? route.params.id : ''
})
const isSlug = computed(() => !/^[0-9a-f-]{36}$/.test(routeParam.value))

const starredIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => {
  void feedStore.togglePostBookmark(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id)
}

const authHeader = computed(() => ({ Authorization: `Bearer ${authStore.token}` }))
const isOwner = computed(() => !!channel.value && channel.value.user_id === authStore.user?.uuid)
const channelRssUrl = computed(() => {
  if (!channel.value?.slug) return ''
  return api.rss.channel(channel.value.slug)
})

const filteredPosts = computed(() => channelPosts.value)

const formatDate = (date: string) => {
  if (!date) return '-'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function responseData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}

function responseMeta(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !('meta' in payload)) return undefined
  const meta = (payload as { meta?: unknown }).meta
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? meta as { total?: unknown; has_more?: unknown }
    : undefined
}

function normalizeCollection(payload: unknown): Collection | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const item = payload as Record<string, unknown>
  const id = item.id ?? item.ID
  const name = item.name ?? item.Name
  if (id === undefined || name === undefined) return null
  return {
    ...(item as Partial<Collection>),
    id: String(id),
    channel_id: String(item.channel_id ?? item.ChannelID ?? ''),
    name: String(name),
    description: String(item.description ?? item.Description ?? ''),
    cover_url: String(item.cover_url ?? item.CoverURL ?? ''),
    created_at: String(item.created_at ?? item.CreatedAt ?? ''),
    updated_at: String(item.updated_at ?? item.UpdatedAt ?? ''),
    is_default: Boolean(item.is_default ?? item.IsDefault),
  }
}

const fetchChannel = async (param: string, slug: boolean, generation: number) => {
  try {
    const url = slug
      ? api.blog.channelBySlug(param)
      : api.blog.channel(param)
    const res = await apiRequestResult(url)
    if (generation !== loadGeneration || !res.ok) {
      if (generation === loadGeneration && res.status !== 404) loadError.value = '频道加载失败，请重试'
      return null
    }
    const data = await Promise.resolve(res.data)
    if (generation !== loadGeneration) return null
    const loadedChannel = responseData<Channel | null>(data) || null
    channel.value = loadedChannel

    if (authStore.isAuthenticated && loadedChannel) {
      channelSubscribeLoading.value = true
      const subscribed = await feedStore.isSubscribedToChannel(loadedChannel.id)
      if (generation !== loadGeneration) return null
      channelSubscribed.value = subscribed
      channelSubscribeLoading.value = false
    }
    return loadedChannel
  } catch {
    if (generation === loadGeneration) {
      channelSubscribeLoading.value = false
      loadError.value = '频道加载失败，请重试'
    }
    return null
  }
}

const fetchCollections = async (loadedChannel: Channel, param: string, slug: boolean, generation: number) => {
  try {
    const url = slug
      ? api.blog.channelCollectionsBySlug(param)
      : api.blog.channelCollections(loadedChannel.id)
    const res = await apiRequestResult(url)
    if (!res.ok || generation !== loadGeneration) {
      if (generation === loadGeneration && !res.ok) loadError.value = '频道合集加载失败，请重试'
      return
    }
    const data = await Promise.resolve(res.data)
    if (generation === loadGeneration) {
      const nextCollections = responseData<unknown>(data)
      collections.value = Array.isArray(nextCollections)
        ? nextCollections.map(normalizeCollection).filter((item): item is Collection => Boolean(item))
        : []
    }
  } catch {
    if (generation === loadGeneration) loadError.value = '频道合集加载失败，请重试'
  }
}

const fetchPosts = async (loadedChannel: Channel, generation: number, page = 1, append = false) => {
  const requestId = ++postsRequestId
  postsLoading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    const params = new URLSearchParams({
      channel_id: loadedChannel.id,
      view: 'summary',
      page: String(page),
      page_size: '20',
    })
    if (activeCollectionId.value) params.set('collection_id', activeCollectionId.value)
    const res = await apiRequestResult(`${api.blog.posts}?${params}`, { headers })
    if (generation !== loadGeneration || requestId !== postsRequestId || !res.ok) {
      if (generation === loadGeneration && requestId === postsRequestId && !res.ok) loadError.value = '频道文章加载失败，请重试'
      return
    }
    const data = await Promise.resolve(res.data)
    if (generation !== loadGeneration || requestId !== postsRequestId) return
    const nextPosts = responseData<Post[]>(data)
    const normalizedPosts = Array.isArray(nextPosts) ? nextPosts : []
    channelPosts.value = append ? [...channelPosts.value, ...normalizedPosts] : normalizedPosts
    postsPage.value = page
    postsTotal.value = Number(responseMeta(data)?.total ?? channelPosts.value.length)
    postsHasMore.value = Boolean(responseMeta(data)?.has_more)
  } catch {
    if (generation === loadGeneration && requestId === postsRequestId) loadError.value = '频道文章加载失败，请重试'
  } finally {
    if (generation === loadGeneration && requestId === postsRequestId) postsLoading.value = false
  }
}

const loadMorePosts = () => {
  if (!channel.value || !postsHasMore.value || postsLoading.value) return
  void fetchPosts(channel.value, loadGeneration, postsPage.value + 1, true)
}

const saveCollection = async () => {
  if (!collectionForm.value.name.trim() || !channel.value) return
  collectionSaving.value = true
  collectionActionError.value = ''
  try {
    let res: Awaited<ReturnType<typeof apiRequestResult>>
    if (editingCollection.value) {
      res = await apiRequestResult(api.blog.collection(editingCollection.value.id), {
        method: 'PUT',
        headers: { ...authHeader.value, 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionForm.value)
      })
    } else {
      res = await apiRequestResult(api.blog.channelCollections(channel.value.id), {
        method: 'POST',
        headers: { ...authHeader.value, 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionForm.value)
      })
    }
    if (!res.ok) throw new Error('合集保存失败，请重试')
    collectionModalOpen.value = false
    await fetchCollections(channel.value, routeParam.value, isSlug.value, loadGeneration)
  } catch (e) {
    reportError(e)
    collectionActionError.value = errorMessage(e, '合集保存失败，请重试')
  } finally { collectionSaving.value = false }
}

const toggleChannelSubscribe = async () => {
  if (!channel.value) return
  const channelId = channel.value.id
  const subscribed = channelSubscribed.value
  const generation = loadGeneration
  channelSubscribeLoading.value = true
  try {
    const success = subscribed
      ? await feedStore.unsubscribeFromChannel(channelId)
      : await feedStore.subscribeToChannel(channelId)
    if (success && generation === loadGeneration && channel.value?.id === channelId) {
      channelSubscribed.value = !subscribed
    }
  } finally {
    if (generation === loadGeneration && channel.value?.id === channelId) {
      channelSubscribeLoading.value = false
    }
  }
}

const copyRssLink = async () => {
  if (!channelRssUrl.value) return
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(channelRssUrl.value)
    toastMessage.value = '已复制 RSS 链接'
  } catch {
    toastMessage.value = '复制失败，请手动复制 RSS 链接'
  } finally {
    toastVisible.value = true
  }
}

const loadChannel = async () => {
  const generation = ++loadGeneration
  postsRequestId++
  const param = routeParam.value
  const slug = isSlug.value
  loading.value = true
  loadError.value = ''
  channel.value = null
  collections.value = []
  channelPosts.value = []
  activeCollectionId.value = null
  channelSubscribed.value = false
  channelSubscribeLoading.value = false
  postsLoading.value = false
  postsPage.value = 1
  postsTotal.value = 0
  postsHasMore.value = false

  if (!param) {
    loading.value = false
    loadError.value = '未指定频道'
    return
  }

  const loadedChannel = await fetchChannel(param, slug, generation)
  if (generation !== loadGeneration) return
  if (!loadedChannel) {
    loading.value = false
    return
  }

  void loadCreatorTheme(loadedChannel.user?.uuid || loadedChannel.user_id).catch(() => { /* Optional creator styling must not interrupt channel content. */ })
  await Promise.all([
    fetchCollections(loadedChannel, param, slug, generation),
    fetchPosts(loadedChannel, generation),
  ])
  if (generation === loadGeneration) loading.value = false
}

watch(routeParam, () => {
  void loadChannel()
})

onMounted(() => {
  void loadChannel()
  if (authStore.isAuthenticated) {
    void feedStore.fetchBookmarkedPostIds()
    void feedStore.fetchReadingListIds()
  }
})
</script>

<style scoped>
.channel-header {
  padding-bottom: 1.125rem;
}

.channel-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.channel-title-wrap {
  flex: 1;
  min-width: 0;
}

.channel-title {
  margin: 0 0 0.5rem;
  font-size: 1.625rem;
  font-weight: 500;
  color: var(--a-text-primary);
  line-height: 1.25;
  letter-spacing: 0;
}

.channel-description {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--a-text-secondary);
  line-height: 1.6;
}

.channel-actions {
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

.channel-meta-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.625rem;
  font-size: 0.8125rem;
  color: var(--a-text-muted);
}

.channel-author-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.channel-author-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 500;
  color: var(--a-text-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}

.channel-author-link:hover {
  color: var(--a-primary);
}

.author-handle {
  color: var(--a-text-muted);
  font-weight: 400;
}

.meta-dot {
  color: var(--a-text-muted);
  opacity: 0.6;
}

/* 核心：去掉边框，下方加一条横线 */
.channel-divider {
  width: 100%;
  height: 1px;
  background-color: var(--a-color-border-soft, #f0f0f0);
  margin-bottom: 1.75rem;
}

.channel-posts-section {
  display: flex;
  flex-direction: column;
}

.channel-posts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.channel-load-more {
  display: flex;
  justify-content: center;
  margin-top: 1.5rem;
}

.channel-skeleton-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.channel-skeleton-header {
  height: 4.5rem;
  border-radius: var(--a-radius-card, 4px);
}

.channel-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.channel-skeleton-item {
  height: 6rem;
  border-radius: var(--a-radius-card, 4px);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.theme-customize-launcher {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: var(--a-layer-normal-sheet-panel, 310);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background-color: var(--a-color-surface);
  color: var(--a-color-text);
  border: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  outline: none;
}

.theme-customize-launcher:hover {
  background-color: var(--a-color-surface-muted);
  border-color: var(--a-color-border);
}

.theme-customize-launcher:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .channel-header-top {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .channel-actions {
    justify-content: flex-start;
  }

  .channel-title {
    font-size: 1.375rem;
  }
}
</style>
