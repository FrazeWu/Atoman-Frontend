<template>
  <div class="a-page-xl">
    <PToast v-model="toastVisible" :message="toastMessage" />
    <div v-if="loading" class="a-grid-2" style="margin-top:1rem">
      <div v-for="i in 4" :key="i" class="a-skeleton" style="height:10rem" />
    </div>

    <PEmpty v-else-if="!channel" title="频道不存在" description="该频道已被删除或链接无效" />

    <template v-else>
      <!-- Channel header -->
      <PPageHeader :title="channel.name" accent :sub="channel.description">
        <template #action>
          <div class="ui-actions-row">
            <PClip
              v-if="authStore.isAuthenticated && !isOwner"
              :disabled="channelSubscribeLoading"
              @click="toggleChannelSubscribe"
            >
              {{ channelSubscribeLoading ? '处理中...' : (channelSubscribed ? '已订阅' : '订阅') }}
            </PClip>
            <PButton v-if="authStore.isAuthenticated && !isOwner" data-testid="message-channel" :to="{ path: '/inbox', query: { tab: 'dm', target_type: 'channel', target_id: channel.id } }" size="sm" variant="secondary">私信</PButton>
            <PClip v-if="channelRssUrl" label="RSS" @click="copyRssLink" />
          </div>
        </template>
      </PPageHeader>

      <!-- Author info -->
      <PSurface class="channel-meta-card" :layer="1">
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">作者</p>
          <a
            :href="userUrl(channel.user?.username || '')"
            style="font-weight: 500;font-size:1rem;text-decoration:none;color:#000"
          >{{ channel.user?.display_name || channel.user?.username || '未知作者' }}</a>
        </div>
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">更新时间</p>
          <p style="font-weight: 500;margin:0">{{ formatDate(channel.updated_at) }}</p>
        </div>
      </PSurface>

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
              全部内容 <span class="collection-count">{{ channelPosts.length }}</span>
            </PTab>
            <PTab
              v-for="col in collections"
              :key="col.id"
              :active="activeCollectionId === col.id"
              @click="activeCollectionId = col.id"
            >
              <span class="a-clamp-1">{{ col.name }}</span>
              <span class="collection-count">{{ postCountByCollection(col.id) }}</span>
            </PTab>
          </div>
        </aside>

        <!-- Right: posts -->
        <main class="post-main">
          <PEmpty v-if="!filteredPosts.length" title="暂无内容" description="该合集还没有文章" />
          <div v-else class="post-list">
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
import { RouterLink, useRoute } from 'vue-router'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PModal from '@/components/ui/PModal.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { Channel, Collection, Post } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import PToast from '@/components/ui/PToast.vue'
import PCard from '@/components/ui/PCard.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PEntry from '@/components/ui/PEntry.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PClip from '@/components/ui/PClip.vue'
import PButton from '@/components/ui/PButton.vue'
import PLink from '@/components/ui/PLink.vue'
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

const collectionModalOpen = ref(false)
const editingCollection = ref<Collection | null>(null)
const collectionForm = ref({ name: '', description: '' })
const collectionSaving = ref(false)

const channelSubscribed = ref(false)
const channelSubscribeLoading = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
let loadGeneration = 0

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
  return api.blog.channelArticleRssBySlug(channel.value.slug)
})

const filteredPosts = computed(() => {
  if (activeCollectionId.value === null) return channelPosts.value
  return channelPosts.value.filter(p =>
    (p.collections || []).some(c => c.id === activeCollectionId.value)
  )
})

const formatDate = (date: string) => new Date(date).toLocaleDateString('zh-CN')
const summarize = (content: string) =>
  content.replace(/```[\s\S]*?```/g, ' ').replace(/[>#*_`\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || '暂无摘要'
const postCountByCollection = (cid: string) =>
  channelPosts.value.filter(p => (p.collections || []).some(c => c.id === cid)).length

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

const fetchPosts = async (loadedChannel: Channel, generation: number) => {
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`
    const loadedPosts: Post[] = []
    for (let page = 1; ; page += 1) {
      const params = new URLSearchParams({
        channel_id: loadedChannel.id,
        page: String(page),
        page_size: '100',
      })
      const res = await apiRequestResult(`${api.blog.posts}?${params}`, { headers })
      if (generation !== loadGeneration) return
      if (!res.ok) return
      const data = await Promise.resolve(res.data)
      if (generation !== loadGeneration) return
      loadedPosts.push(...(data.data || []))
      if (!data.meta?.has_more) break
    }
    if (generation === loadGeneration) channelPosts.value = loadedPosts
  } catch {
    return
  }
}

const openCollectionModal = (collection?: Collection) => {
  editingCollection.value = collection || null
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
  await navigator.clipboard.writeText(channelRssUrl.value)
  toastMessage.value = '已复制 RSS 链接'
  toastVisible.value = true
}

const loadChannel = async () => {
  const generation = ++loadGeneration
  const param = routeParam.value
  const slug = isSlug.value
  loading.value = true
  channel.value = null
  collections.value = []
  channelPosts.value = []
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

watch(routeParam, () => { void loadChannel() }, { immediate: true })
</script>

<style scoped>
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
  .channel-body { flex-direction: column; }
  .collection-sidebar { width: 100%; position: static; }
  .collection-list { flex-direction: row; overflow-x: auto; padding-bottom: .5rem; }
}
</style>
