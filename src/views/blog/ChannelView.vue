<template>
  <div class="a-page-xl">
    <PToast v-model="toastVisible" :message="toastMessage" />
    <BookmarkFolderModal ref="bookmarkModalRef" />
    <div v-if="loading" class="a-grid-2" style="margin-top:1rem">
      <div v-for="i in 4" :key="i" class="a-skeleton" style="height:10rem" />
    </div>

    <PEmpty v-else-if="!channel" title="频道不存在" description="该频道已被删除或链接无效" />

    <template v-else>
      <!-- Channel header -->
      <PPageHeader :title="channel.name" accent :sub="channel.description">
        <template #action>
          <div class="paper-actions-row">
            <PClip
              v-if="authStore.isAuthenticated && !isOwner"
              :disabled="channelSubscribeLoading"
              @click="toggleChannelSubscribe"
            >
              {{ channelSubscribeLoading ? '处理中...' : (channelSubscribed ? '已订阅' : '订阅') }}
            </PClip>
            <PClip v-if="channelRssUrl" label="RSS" @click="copyRssLink" />
            <PLink
              v-if="isOwner"
              :href="modulePathUrl('blog', `/channel/${channel.slug || channel.id}/manage`)"
              label="管理"
            />
            <PLink
              v-if="isOwner"
              :href="`/posts/post/new?channel=${channel.id}`"
              label="写文章"
            />
          </div>
        </template>
      </PPageHeader>

      <!-- Author info -->
      <PSurface class="channel-meta-card" :layer="1">
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">作者</p>
          <a
            :href="userUrl(channel.user?.username || '')"
            style="font-weight:900;font-size:1rem;text-decoration:none;color:#000"
          >{{ channel.user?.display_name || channel.user?.username || '未知作者' }}</a>
        </div>
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">更新时间</p>
          <p style="font-weight:700;margin:0">{{ formatDate(channel.updated_at) }}</p>
        </div>
      </PSurface>

      <!-- Two-column layout: left collections, right posts -->
      <div class="channel-body">
        <!-- Left: collection list -->
        <aside class="collection-sidebar">
          <div class="section-headline">
            <h2 class="a-subtitle" style="margin:0;font-size:.875rem">合集</h2>
            <PClip v-if="isOwner" label="新建合集" @click="openCollectionModal()" />
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
            <PEntry
              v-for="post in filteredPosts"
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
                    :href="`/posts/post/${post.id}/edit`"
                    label="编辑"
                  />
                </div>
              </template>
            </PEntry>
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
        <PPress label="取消" variant="secondary" @click="collectionModalOpen = false" />
        <PPress :disabled="!collectionForm.name.trim() || collectionSaving" :loading="collectionSaving" loading-text="保存中..." @click="saveCollection">
          {{ editingCollection ? '更新' : '创建' }}
        </PPress>
      </div>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import BookmarkFolderModal from '@/components/blog/BookmarkFolderModal.vue'
import PCard from '@/components/ui/PCard.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PClip from '@/components/ui/PClip.vue'
import PLink from '@/components/ui/PLink.vue'
import PTab from '@/components/ui/PTab.vue'
import PPress from '@/components/ui/PPress.vue'
import { resolveSiteContext } from '@/router/siteContext'
import { modulePathUrl, userUrl } from '@/composables/useSubdomainNav'

const props = defineProps<{ entityHandle?: string }>()
const route = useRoute()
const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const bookmarkModalRef = ref<InstanceType<typeof BookmarkFolderModal> | null>(null)

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
  void bookmarkModalRef.value?.open(id)
}

const toggleReadingList = (id: string) => {
  void feedStore.toggleReadingListItem(id, 'post')
}

const authHeader = computed(() => ({ Authorization: `Bearer ${authStore.token}` }))
const isOwner = computed(() => !!channel.value && channel.value.user_id === authStore.user?.uuid)
const channelRssUrl = computed(() => {
  if (!channel.value?.slug) return ''
  return api.blog.channelArticleRssBySlug(channel.value.slug)
})

const filteredPosts = computed(() => {
  if (activeCollectionId.value === null) return channelPosts.value
  return channelPosts.value.filter(p => p.collection_id === activeCollectionId.value)
})

const formatDate = (date: string) => new Date(date).toLocaleDateString('zh-CN')
const summarize = (content: string) =>
  content.replace(/```[\s\S]*?```/g, ' ').replace(/[>#*_`\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || '暂无摘要'
const postCountByCollection = (cid: string) =>
  channelPosts.value.filter(p => p.collection_id === cid).length

const fetchChannel = async () => {
  const url = isSlug.value
    ? api.blog.channelBySlug(routeParam.value)
    : api.blog.channel(routeParam.value)
  const res = await fetch(url)
  if (!res.ok) { channel.value = null; return }
  const data = await res.json()
  channel.value = (data.data || null) as Channel | null

  if (authStore.isAuthenticated && channel.value) {
    channelSubscribeLoading.value = true
    channelSubscribed.value = await feedStore.isSubscribedToChannel(channel.value.id)
    channelSubscribeLoading.value = false
  }
}

const fetchCollections = async () => {
  if (!channel.value) return
  const url = isSlug.value
    ? api.blog.channelCollectionsBySlug(routeParam.value)
    : api.blog.channelCollections(channel.value.id)
  const res = await fetch(url)
  if (res.ok) collections.value = (await res.json()).data || []
}

const fetchPosts = async () => {
  if (!channel.value) return
  const params = new URLSearchParams({ channel_id: channel.value.id, limit: '100' })
  const headers: Record<string, string> = {}
  if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`
  params.set('page_size', '100')
  const res = await fetch(`${api.blog.posts}?${params}`, { headers })
  if (res.ok) channelPosts.value = (await res.json()).data || []
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
    if (editingCollection.value) {
      await fetch(api.blog.collection(editingCollection.value.id), {
        method: 'PUT',
        headers: { ...authHeader.value, 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionForm.value)
      })
    } else {
      await fetch(api.blog.channelCollections(channel.value.id), {
        method: 'POST',
        headers: { ...authHeader.value, 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionForm.value)
      })
    }
    collectionModalOpen.value = false
    await fetchCollections()
  } catch (e) { console.error(e) } finally { collectionSaving.value = false }
}

const toggleChannelSubscribe = async () => {
  if (!channel.value) return
  channelSubscribeLoading.value = true
  try {
    const success = channelSubscribed.value
      ? await feedStore.unsubscribeFromChannel(channel.value.id)
      : await feedStore.subscribeToChannel(channel.value.id)
    if (success) channelSubscribed.value = !channelSubscribed.value
  } finally { channelSubscribeLoading.value = false }
}

const copyRssLink = async () => {
  if (!channelRssUrl.value) return
  await navigator.clipboard.writeText(channelRssUrl.value)
  toastMessage.value = '已复制 RSS 链接'
  toastVisible.value = true
}

onMounted(async () => {
  try {
    await fetchChannel()
    if (!channel.value) return
    void Promise.all([fetchCollections(), fetchPosts()])
    if (authStore.isAuthenticated) {
      void feedStore.fetchBookmarkedPostIds()
      void feedStore.fetchReadingListIds()
    }
  } finally { loading.value = false }
})
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
  align-items: flex-start;
  gap: .5rem;
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

.paper-actions-row,
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
