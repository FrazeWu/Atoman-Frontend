<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, ref, watch } from 'vue'

import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useAuthStore } from '@/stores/auth'
import type { Collection, Post } from '@/types'
import type { BlogCollectionLayer } from '@/components/blog/blogSheetTypes'
import { useBlogSheetNavigation } from '@/composables/useBlogSheetNavigation'

const props = withDefaults(defineProps<{
  layer: BlogCollectionLayer
  layerIndex?: number
  stackSize?: number
}>(), {
  layerIndex: 0,
  stackSize: 1,
})

const api = useApi()
const authStore = useAuthStore()
const sheets = useBlogSheets()

const collection = ref<Collection | null>(null)
const posts = ref<Post[]>([])
const loading = ref(false)
const errorMessage = ref('')
const filter = ref<'all' | 'published' | 'draft'>('all')

const filterOptions = computed(() => [
  { label: '全部', value: 'all' },
  { label: '已发布', value: 'published' },
  ...(authStore.isAuthenticated ? [{ label: '草稿', value: 'draft' }] : []),
])

const collectionId = computed(() => props.layer.payload.collectionId)
const replaceCurrentCollection = (id: string) => sheets.replaceCollection(id, '合集', props.layer.payload.channelId)
const channelId = computed(() => collection.value?.channel_id || props.layer.payload.channelId)
const visiblePosts = computed(() => (
  filter.value === 'all'
    ? posts.value
    : posts.value.filter(post => post.status === filter.value)
))
const publishedCount = computed(() => posts.value.filter(post => post.status !== 'draft').length)
const draftCount = computed(() => posts.value.filter(post => post.status === 'draft').length)
const isTopSheet = computed(() => sheets.isTop(props.layer.key))
const { navigation, loading: navigationLoading, direction: navigationDirection, navigate } = useBlogSheetNavigation('collection', collectionId, replaceCurrentCollection, isTopSheet)
let loadSequence = 0

const sortTime = (post: Post) => Date.parse(post.updated_at || post.created_at || '') || 0

async function loadCollection() {
  const requestedCollectionId = collectionId.value
  const requestSequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  collection.value = null
  posts.value = []
  try {
    const headers: HeadersInit = authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
    const [collectionRes, publishedRes] = await Promise.all([
      apiRequestResult(api.blog.collection(requestedCollectionId), { headers }),
      apiRequestResult(`${api.blog.posts}?collection_id=${requestedCollectionId}`, { headers }),
    ])
    if (requestSequence !== loadSequence || requestedCollectionId !== collectionId.value) return
    if (!collectionRes.ok || !publishedRes.ok) throw new Error('load failed')

    collection.value = collectionRes.data.data
    const published = (publishedRes.data.data || []) as Post[]
    let drafts: Post[] = []
    if (authStore.isAuthenticated) {
      const draftsRes = await apiRequestResult(api.blog.drafts, { headers })
      if (requestSequence !== loadSequence || requestedCollectionId !== collectionId.value) return
      if (draftsRes.ok) {
        drafts = ((draftsRes.data.data || []) as Post[]).filter(post =>
          post.collection_id === requestedCollectionId || post.collection?.id === requestedCollectionId,
        )
      }
    }
    if (requestSequence !== loadSequence || requestedCollectionId !== collectionId.value) return
    posts.value = Array.from(new Map([...published, ...drafts].map(post => [post.id, post])).values())
      .sort((left, right) => sortTime(right) - sortTime(left))
  } catch {
    if (requestSequence !== loadSequence || requestedCollectionId !== collectionId.value) return
    errorMessage.value = '合集内容加载失败，请重试'
  } finally {
    if (requestSequence === loadSequence && requestedCollectionId === collectionId.value) loading.value = false
  }
}

watch(collectionId, () => void loadCollection(), { immediate: true })
</script>

<template>
  <PSheet
    :show="sheets.isActive(layer.key)"
    :title="`合集-${collection?.name || layer.title || '未命名'}`"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key)"
    :is-top-layer="sheets.isTop(layer.key)"
    close-type="both"
    :navigation="navigation"
    :navigation-key="collectionId"
    :navigation-direction="navigationDirection"
    :navigation-loading="navigationLoading"
    @close="sheets.closeLayer(layer.key)"
    @activate="sheets.returnToLayer(layer.key)"
    @navigate="navigate"
  >
    <template #header>
      <div class="collection-sheet-header">
        <div class="collection-sheet-visual">
          <img v-if="collection?.cover_url" :src="collection.cover_url" :alt="collection.name" />
          <span v-else aria-hidden="true">{{ (collection?.name || layer.title).slice(0, 1).toUpperCase() }}</span>
        </div>
        <div class="collection-sheet-heading">
          <span class="a-label a-muted">{{ collection?.is_default ? '默认合集' : '合集' }}</span>
          <h2>{{ collection?.is_default ? '全部文章' : (collection?.name || layer.title) }}</h2>
          <p v-if="collection?.description" class="a-muted">{{ collection.description }}</p>
        </div>
      </div>
    </template>

    <div class="collection-sheet-body">
      <div class="collection-sheet-toolbar">
        <PSegmentedControl v-model="filter" :options="filterOptions" />
        <div class="collection-sheet-counts" aria-live="polite">
          <span>{{ publishedCount }} 篇文章</span>
          <span v-if="authStore.isAuthenticated">{{ draftCount }} 篇草稿</span>
        </div>
      </div>

      <div v-if="loading" class="collection-sheet-loading" aria-label="正在加载合集">
        <div v-for="index in 4" :key="index" class="a-skeleton" />
      </div>
      <PEmpty v-else-if="errorMessage" kicker="" title="加载失败" :description="errorMessage">
        <template #action>
          <PButton variant="secondary" size="sm" @click="loadCollection">重试</PButton>
        </template>
      </PEmpty>
      <PEmpty v-else-if="visiblePosts.length === 0" kicker="" title="暂无文章" description="可以从当前合集开始写作" />
      <div v-else class="collection-post-list">
        <article
          v-for="post in visiblePosts"
          :key="post.id"
          class="collection-post-row"
          data-test="collection-post-row"
          tabindex="0"
          @click="sheets.openPost(post.id, post.title, collectionId)"
          @keydown.enter="sheets.openPost(post.id, post.title, collectionId)"
        >
          <div class="collection-post-copy">
            <div class="collection-post-title-row">
              <span v-if="post.status === 'draft'" class="a-badge">草稿</span>
              <h3>{{ post.title }}</h3>
            </div>
            <p v-if="post.summary" class="a-muted">{{ post.summary }}</p>
            <span class="collection-post-date">{{ new Date(post.updated_at || post.created_at).toLocaleDateString('zh-CN') }}</span>
          </div>
        </article>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.collection-sheet-header,
.collection-sheet-toolbar,
.collection-post-row,
.collection-post-title-row,
.collection-sheet-counts,
.collection-post-edit {
  display: flex;
  align-items: center;
}

.collection-sheet-header {
  justify-content: space-between;
  gap: 1.5rem;
  width: 100%;
}

.collection-sheet-visual {
  display: grid;
  flex: 0 0 9rem;
  place-items: center;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  font-size: 2rem;
  font-weight: 650;
}

.collection-sheet-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}


.collection-sheet-heading h2 {
  margin: 0.25rem 0 0;
  font-size: 1.4rem;
}

.collection-sheet-heading p {
  margin: 0.35rem 0 0;
}

.collection-sheet-body {
  padding: 1.5rem;
}

.collection-sheet-toolbar {
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.collection-sheet-counts {
  gap: 1rem;
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.collection-sheet-loading {
  display: grid;
  gap: 0.75rem;
}

.collection-sheet-loading .a-skeleton {
  height: 5.5rem;
}

.collection-post-list {
  border-top: 1px solid var(--a-color-border-soft);
}

.collection-post-row {
  justify-content: space-between;
  gap: 1rem;
  min-height: 5.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  cursor: pointer;
}

.collection-post-row:hover,
.collection-post-row:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.collection-post-copy {
  min-width: 0;
}

.collection-post-title-row {
  gap: 0.5rem;
}

.collection-post-title-row h3 {
  margin: 0;
  font-size: 1rem;
}

.collection-post-copy p {
  margin: 0.35rem 0;
}

.collection-post-date {
  color: var(--a-color-muted-soft);
  font-size: 0.75rem;
}

.collection-post-edit {
  gap: 0.35rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
}

@media (max-width: 640px) {
  .collection-sheet-header,
  .collection-sheet-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .collection-sheet-counts {
    justify-content: space-between;
  }
}
</style>
