<template>
  <div class="a-page-xl">
    <PToast v-model="toastVisible" :message="toastMessage" />
    <div v-if="loading" class="a-grid-2" style="margin-top:1rem">
      <div v-for="i in 4" :key="i" class="a-skeleton" style="height:10rem" />
    </div>

    <PEmpty v-else-if="!channel" title="频道不存在" description="该频道已被删除或链接无效" />

    <template v-else>
      <section class="channel-identity-card" aria-labelledby="channel-title">
        <div class="channel-identity-card__cover" aria-hidden="true">
          <img v-if="channel.cover_url" :src="channel.cover_url" alt="" />
          <span v-else>{{ channel.name.slice(0, 1).toUpperCase() }}</span>
        </div>

        <div class="channel-identity-card__content">
          <p class="channel-identity-card__eyebrow">博客频道</p>
          <h1 id="channel-title" class="channel-identity-card__title">{{ channel.name }}</h1>
          <p v-if="channel.description" class="channel-identity-card__description">{{ channel.description }}</p>
          <div class="channel-identity-card__author">
            <PAvatar
              :src="channel.user?.avatar_url"
              :name="channel.user?.display_name || channel.user?.username || '未知作者'"
              :alt="`${channel.user?.display_name || channel.user?.username || '未知作者'} 的头像`"
              size="xs"
            />
            <a
              v-if="channel.user?.username"
              :href="userUrl(channel.user.username)"
              class="channel-identity-card__author-link"
            >
              {{ channel.user.display_name || channel.user.username }}
              <span>@{{ channel.user.username }}</span>
            </a>
            <span v-else class="channel-identity-card__author-link">未知作者</span>
          </div>
          <div class="channel-identity-card__stats" aria-label="频道统计">
            <span><FileText :size="14" aria-hidden="true" />{{ postsTotal }} 篇文章</span>
            <span><FolderKanban :size="14" aria-hidden="true" />{{ collections.length }} 个合集</span>
            <span><CalendarDays :size="14" aria-hidden="true" />{{ formatDate(channel.updated_at) }} 更新</span>
          </div>
        </div>

        <div class="channel-identity-card__actions">
          <PButton
            v-if="authStore.isAuthenticated && !isOwner"
            variant="primary"
            :disabled="channelSubscribeLoading"
            :loading="channelSubscribeLoading"
            :label="channelSubscribed ? '已订阅' : '订阅频道'"
            @click="toggleChannelSubscribe"
          />
          <PButton
            v-if="authStore.isAuthenticated && !isOwner"
            data-testid="message-channel"
            :to="{ path: '/inbox', query: { tab: 'dm', target_type: 'channel', target_id: channel.id } }"
            size="sm"
            variant="secondary"
            label="私信"
          />
          <PClip v-if="channelRssUrl" label="RSS" @click="copyRssLink" />
        </div>
      </section>

      <!-- Two-column layout: left collections, right posts -->
      <div class="channel-body">
        <!-- Left: collection list -->
        <aside class="collection-sidebar">
          <div class="section-headline">
            <h2 class="a-subtitle" style="margin:0;font-size:.875rem">合集</h2>
          </div>

          <div class="collection-list">
            <PTab
              :active="activeCollectionId === null"
              @click="activeCollectionId = null"
            >
              全部内容 <span class="collection-count">{{ postsTotal }}</span>
            </PTab>
            <BlogEntityCard
              v-for="col in collections"
              :key="col.id"
              kind="collection"
              :title="col.name"
              :cover-url="col.cover_url"
              :description="col.description"
              compact
              :active="activeCollectionId === col.id"
              :show-subscribe="false"
              @select="openCollectionSheet(col)"
            />
          </div>
        </aside>

        <!-- Right: posts -->
        <main class="post-main">
          <PEmpty v-if="!postsLoading && !filteredPosts.length" title="暂无内容" description="该合集还没有文章" />
          <div v-else class="post-list feed-timeline-box">
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
          <div v-if="postsHasMore" class="post-load-more">
            <PButton variant="secondary" :loading="postsLoading" @click="loadMorePosts">加载更多</PButton>
          </div>
        </main>
      </div>
    </template>

    <!-- Collection Modal -->
    <PModal v-if="collectionModalOpen" @close="collectionModalOpen = false">
      <h3 class="a-subtitle" style="margin-bottom:1.5rem">{{ editingCollection ? '编辑合集' : '新建合集' }}</h3>
      <div style="display:flex;flex-direction:column;gap:1rem">
        <PInput v-model="collectionForm.name" placeholder="合集名称*" />
        <PTextarea v-model="collectionForm.description" placeholder="合集描述（可选）" :rows="3" />
      </div>
      <div class="modal-actions">
        <PButton label="取消" variant="secondary" @click="collectionModalOpen = false" />
        <PButton :disabled="!collectionForm.name.trim() || collectionSaving" :loading="collectionSaving" loading-text="保存中..." @click="saveCollection">
          {{ editingCollection ? '更新' : '创建' }}
        </PButton>
      </div>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { IconFileText as FileText, IconFolder as FolderKanban, IconCalendar as CalendarDays } from '@tabler/icons-vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PModal from '@/components/ui/PModal.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { Channel, Collection, Post } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import PToast from '@/components/ui/PToast.vue'
import BlogEntityCard from '@/components/blog/BlogEntityCard.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PClip from '@/components/ui/PClip.vue'
import PButton from '@/components/ui/PButton.vue'
import PTab from '@/components/ui/PTab.vue'
import { resolveSiteContext } from '@/router/siteContext'
import { userUrl } from '@/composables/useSubdomainNav'
import { useBlogSheets } from '@/composables/useBlogSheets'

const props = defineProps<{ entityHandle?: string }>()
const route = useRoute()
const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const blogSheets = useBlogSheets()

const loading = ref(true)
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

const formatDate = (date: string) => new Date(date).toLocaleDateString('zh-CN')
const summarize = (content: string) =>
  content.replace(/```[\s\S]*?```/g, ' ').replace(/[>#*_`\x5b\x5d()!-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || '暂无摘要'

const fetchChannel = async (param: string, slug: boolean, generation: number) => {
  try {
    const url = slug
      ? api.blog.channelBySlug(param)
      : api.blog.channel(param)
    const res = await apiRequestResult(url)
    if (generation !== loadGeneration || !res.ok) return null
    const data = await Promise.resolve(res.data)
    if (generation !== loadGeneration) return null
    const loadedChannel = (data.data || null) as Channel | null
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
    if (generation === loadGeneration) channelSubscribeLoading.value = false
    return null
  }
}

const fetchCollections = async (loadedChannel: Channel, param: string, slug: boolean, generation: number) => {
  try {
    const url = slug
      ? api.blog.channelCollectionsBySlug(param)
      : api.blog.channelCollections(loadedChannel.id)
    const res = await apiRequestResult(url)
    if (!res.ok || generation !== loadGeneration) return
    const data = await Promise.resolve(res.data)
    if (generation === loadGeneration) collections.value = data.data || []
  } catch {
    return
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
      page: String(page),
      page_size: '20',
    })
    if (activeCollectionId.value) params.set('collection_id', activeCollectionId.value)
    const res = await apiRequestResult(`${api.blog.posts}?${params}`, { headers })
    if (generation !== loadGeneration || requestId !== postsRequestId || !res.ok) return
    const data = await Promise.resolve(res.data)
    if (generation !== loadGeneration || requestId !== postsRequestId) return
    const nextPosts = (data.data || []) as Post[]
    channelPosts.value = append ? [...channelPosts.value, ...nextPosts] : nextPosts
    postsPage.value = page
    postsTotal.value = Number(data.meta?.total ?? channelPosts.value.length)
    postsHasMore.value = Boolean(data.meta?.has_more)
  } catch {
    return
  } finally {
    if (generation === loadGeneration && requestId === postsRequestId) postsLoading.value = false
  }
}

const loadMorePosts = () => {
  if (!channel.value || !postsHasMore.value || postsLoading.value) return
  void fetchPosts(channel.value, loadGeneration, postsPage.value + 1, true)
}

const openCollectionSheet = (collection: Collection) => {
  if (!channel.value) return
  blogSheets.openCollection(collection.id, collection.name, channel.value.id)
}

const openCollectionModal = (collection?: Collection) => {
  collectionForm.value = { name: collection?.name || '', description: collection?.description || '' }
  collectionModalOpen.value = true
}

const saveCollection = async () => {
  if (!collectionForm.value.name.trim() || !channel.value) return
  collectionSaving.value = true
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
    if (!res.ok) return
    collectionModalOpen.value = false
    await fetchCollections(channel.value, routeParam.value, isSlug.value, loadGeneration)
  } catch (e) { reportError(e) } finally { collectionSaving.value = false }
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
  channel.value = null
  collections.value = []
  channelPosts.value = []
  postsPage.value = 1
  postsTotal.value = 0
  postsHasMore.value = false
  activeCollectionId.value = null
  channelSubscribed.value = false
  channelSubscribeLoading.value = false
  try {
    if (!param) return
    const loadedChannel = await fetchChannel(param, slug, generation)
    if (!loadedChannel || generation !== loadGeneration) return
    void Promise.all([
      fetchCollections(loadedChannel, param, slug, generation),
      fetchPosts(loadedChannel, generation),
    ]).catch(() => {})
    if (authStore.isAuthenticated) {
      void feedStore.fetchBookmarkedPostIds()
      void feedStore.fetchReadingListIds()
    }
  } catch {
    return
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}

watch(activeCollectionId, () => {
  if (!channel.value) return
  channelPosts.value = []
  postsPage.value = 1
  postsTotal.value = 0
  postsHasMore.value = false
  void fetchPosts(channel.value, loadGeneration)
})

watch(routeParam, () => { void loadChannel() }, { immediate: true })
</script>

<style scoped>
.channel-identity-card {
  display: grid;
  grid-template-columns: minmax(9rem, 13rem) minmax(0, 1fr) auto;
  gap: 1.25rem;
  align-items: stretch;
  padding: 1rem;
  margin-top: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.channel-identity-card__cover {
  aspect-ratio: 4 / 3;
  min-height: 7rem;
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-size: 2rem;
  font-weight: 650;
}

.channel-identity-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.channel-identity-card__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.channel-identity-card__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--a-color-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.channel-identity-card__title {
  margin: 0;
  color: var(--a-color-fg);
  font-size: 1.35rem;
  line-height: 1.3;
}

.channel-identity-card__description {
  margin: 0.45rem 0 0;
  color: var(--a-color-muted);
  line-height: 1.55;
}

.channel-identity-card__author,
.channel-identity-card__stats,
.channel-identity-card__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.channel-identity-card__author { margin-top: 0.7rem; }

.channel-identity-card__author-link {
  color: var(--a-color-fg);
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
}

.channel-identity-card__author-link span {
  color: var(--a-color-muted);
  font-weight: 400;
}

.channel-identity-card__stats {
  margin-top: auto;
  padding-top: 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.76rem;
}

.channel-identity-card__stats span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.channel-identity-card__actions {
  align-content: flex-start;
  justify-content: flex-end;
}

.channel-body {
  display: flex;
  gap: 2rem;
  margin-top: 2rem;
  align-items: flex-start;
}

.collection-sidebar {
  width: 13rem;
  flex-shrink: 0;
  position: sticky;
  top: 5rem;
}

.post-main { flex: 1; min-width: 0; }
.post-load-more { display: flex; justify-content: center; margin-top: 1.5rem; }

.post-list.feed-timeline-box {
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.collection-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.45rem;
}

.collection-count {
  margin-left: 0.35rem;
  opacity: 0.58;
}

.channel-meta-card {
  padding: 1rem 1.25rem;
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.section-headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: .75rem;
}

.ui-actions-row,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .75rem;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .channel-identity-card {
    grid-template-columns: minmax(7rem, 9rem) minmax(0, 1fr);
    gap: 0.85rem;
  }
  .channel-identity-card__title { font-size: 1.15rem; }
  .channel-identity-card__description { font-size: 0.88rem; }
  .channel-identity-card__actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
  .channel-body { flex-direction: column; align-items: stretch; }
  .collection-sidebar, .post-main { width: 100%; }
  .collection-sidebar { position: static; }
  .collection-list { flex-direction: row; overflow-x: auto; padding-bottom: .5rem; }
}
</style>
