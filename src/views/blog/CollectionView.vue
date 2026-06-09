<template>
  <div class="a-page" style="padding-bottom:12rem">
    <div v-if="loading" style="display:flex;flex-direction:column;gap:1.5rem">
      <div class="a-skeleton" style="height:8rem" />
      <div class="a-skeleton" style="height:2rem;width:50%" />
    </div>

    <AEmpty v-else-if="!collection" text="合集不存在或已被删除" />

    <template v-else>
      <APageHeader :title="collection.name" accent :sub="collection.description || '合集详情'" style="margin-bottom:2.5rem">
        <template #action>
          <div class="paper-actions-row">
            <PaperClip
              v-if="authStore.isAuthenticated && !isOwner"
              :disabled="collectionSubscribeLoading"
              @click="toggleCollectionSubscribe"
            >
              {{ collectionSubscribeLoading ? '处理中...' : (collectionSubscribed ? '已订阅' : '订阅合集') }}
            </PaperClip>
            <PaperLink :href="`/channel/${channelId}?site=blog`" label="返回频道" />
            <PaperLink
              v-if="isOwner"
              :href="`/post/new?site=blog&channel=${channelId}&collection=${collection.id}`"
              label="写文章"
            />
          </div>
        </template>
      </APageHeader>

      <ACard class="collection-meta-card">
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">所属频道</p>
          <PaperLink :href="`/channel/${channelId}?site=blog`">
            {{ channel?.name || '加载中...' }}
          </PaperLink>
        </div>
        <div>
          <p class="a-label a-muted" style="margin-bottom:.4rem">文章数量</p>
          <p style="font-weight:900;margin:0">{{ posts.length }}篇</p>
        </div>
        <div v-if="isOwner" class="paper-actions-row">
          <PaperClip label="编辑" @click="openEditModal" />
          <PaperReject label="删除" @click="confirmDelete" />
        </div>
      </ACard>

      <section>
        <div class="section-headline">
          <ASectionHeader title="收录文章" rule />
          <span class="a-muted" style="font-size:.875rem">{{ posts.length }} 篇</span>
        </div>

        <AEmpty v-if="!posts.length" text="当前合集暂无文章" />
        <div v-else class="post-list">
          <PaperEntry
            v-for="post in posts"
            :key="post.id"
            :title="post.title"
            :summary="post.summary || summarize(post.content)"
            @click="$router.push(`/post/${post.id}?site=blog`)"
          >
            <template #meta>
              <span v-if="post.status !== 'published'" class="a-badge" style="margin-right:0.5rem">草稿</span>
              <span>{{ formatDate(post.updated_at) }}</span>
            </template>
            <template #actions>
              <div style="display:flex;gap:.75rem;align-items:center">
                <PaperClip
                  :active="starredIds.has(post.id)"
                  :label="starredIds.has(post.id) ? '退藏' : '收藏'"
                  @click="toggleStar(post.id)"
                />
                <PaperClip
                  :active="readingListIds.has(post.id)"
                  :label="readingListIds.has(post.id) ? '移出队列' : '稍后阅读'"
                  @click="toggleReadingList(post.id)"
                />
                <PaperLink :href="`/post/${post.id}?site=blog`" label="查看" />
                <PaperLink
                  v-if="isOwner"
                  :href="`/post/${post.id}/edit?site=blog&channel=${channelId}`"
                  label="编辑"
                />
              </div>
            </template>
          </PaperEntry>
        </div>
      </section>

      <!-- Edit Collection Modal -->
      <AModal v-model="editModalOpen" title="编辑合集">
        <div style="display:flex;flex-direction:column;gap:1rem">
          <AInput v-model="form.name" label="合集名称" placeholder="输入合集名称" />
          <ATextarea v-model="form.description" label="合集描述" placeholder="简短介绍这个合集" :rows="3" />
          <div class="modal-actions">
            <PaperPress label="取消" variant="secondary" @click="editModalOpen = false" />
            <PaperPress :disabled="!form.name.trim() || saving" :loading="saving" loading-text="保存中..." @click="saveCollection">
              更新
            </PaperPress>
          </div>
        </div>
      </AModal>

      <!-- Delete Confirmation Modal -->
      <AModal v-model="deleteModalOpen" title="确认删除合集">
        <div style="display:flex;flex-direction:column;gap:1rem">
          <p>确定要删除合集<strong>{{ collection.name }}</strong>吗？此操作不可恢复，但不会删除其中的文章。</p>
          <div class="modal-actions">
            <PaperPress label="取消" variant="secondary" @click="deleteModalOpen = false" />
            <PaperReject label="删除" @click="deleteCollection" />
          </div>
        </div>
      </AModal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AEmpty from '@/components/ui/AEmpty.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import AModal from '@/components/ui/AModal.vue'
import ACard from '@/components/ui/ACard.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import ASectionHeader from '@/components/ui/ASectionHeader.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperLink from '@/components/ui/PaperLink.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import AInput from '@/components/ui/AInput.vue'
import ATextarea from '@/components/ui/ATextarea.vue'
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

const starredIds = computed(() => feedStore.starredItemIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const toggleStar = (id: string) => {
  void feedStore.toggleStar(id)
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
    router.push(`/channel/${channelId.value}`)
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
    void feedStore.fetchStarredIds()
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
