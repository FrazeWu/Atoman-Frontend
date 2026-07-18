<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pencil, Plus } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useAuthStore } from '@/stores/auth'
import type { Collection, Post } from '@/types'
import type { BlogCollectionLayer } from '@/components/blog/blogSheetTypes'

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
const router = useRouter()
const sheets = useBlogSheets()

const collection = ref<Collection | null>(null)
const posts = ref<Post[]>([])
const loading = ref(false)
const errorMessage = ref('')
const filter = ref<'all' | 'published' | 'draft'>('all')

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
]

const collectionId = computed(() => props.layer.payload.collectionId)
const channelId = computed(() => collection.value?.channel_id || props.layer.payload.channelId)
const visiblePosts = computed(() => (
  filter.value === 'all'
    ? posts.value
    : posts.value.filter(post => post.status === filter.value)
))
const publishedCount = computed(() => posts.value.filter(post => post.status !== 'draft').length)
const draftCount = computed(() => posts.value.filter(post => post.status === 'draft').length)

const sortTime = (post: Post) => Date.parse(post.updated_at || post.created_at || '') || 0

async function loadCollection() {
  loading.value = true
  errorMessage.value = ''
  try {
    const headers = authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
    const [collectionRes, publishedRes, draftsRes] = await Promise.all([
      fetch(api.blog.collection(collectionId.value), { headers }),
      fetch(`${api.blog.posts}?collection_id=${collectionId.value}`, { headers }),
      fetch(api.blog.drafts, { headers }),
    ])
    if (!collectionRes.ok || !publishedRes.ok || !draftsRes.ok) throw new Error('load failed')

    collection.value = (await collectionRes.json()).data
    const published = ((await publishedRes.json()).data || []) as Post[]
    const drafts = (((await draftsRes.json()).data || []) as Post[]).filter(post =>
      post.collections?.some(item => item.id === collectionId.value),
    )
    posts.value = Array.from(new Map([...published, ...drafts].map(post => [post.id, post])).values())
      .sort((left, right) => sortTime(right) - sortTime(left))
  } catch {
    errorMessage.value = '合集内容加载失败，请重试'
  } finally {
    loading.value = false
  }
}

function openEditor() {
  void router.push(`/posts/post/new?channel=${channelId.value}&collection=${collectionId.value}`)
}

function editPost(post: Post) {
  void router.push(`/posts/post/${post.id}/edit?channel=${channelId.value}&collection=${collectionId.value}`)
}

watch(collectionId, () => void loadCollection(), { immediate: true })
</script>

<template>
  <PSheet
    show
    :title="collection?.name || layer.title"
    width="860px"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key)"
    :is-top-layer="sheets.isTop(layer.key)"
    close-type="both"
    @close="sheets.closeLayer(layer.key)"
  >
    <template #header>
      <div class="collection-sheet-header">
        <div class="collection-sheet-heading">
          <span class="a-label a-muted">{{ collection?.is_default ? '默认合集' : '合集' }}</span>
          <h2>{{ collection?.is_default ? '全部文章' : (collection?.name || layer.title) }}</h2>
          <p v-if="collection?.description" class="a-muted">{{ collection.description }}</p>
        </div>
        <PButton data-test="write-post" @click="openEditor">
          <Plus :size="16" aria-hidden="true" />
          写文章
        </PButton>
      </div>
    </template>

    <div class="collection-sheet-body">
      <div class="collection-sheet-toolbar">
        <PSegmentedControl v-model="filter" :options="filterOptions" />
        <div class="collection-sheet-counts" aria-live="polite">
          <span>{{ publishedCount }} 篇文章</span>
          <span>{{ draftCount }} 篇草稿</span>
        </div>
      </div>

      <div v-if="loading" class="collection-sheet-loading" aria-label="正在加载合集">
        <div v-for="index in 4" :key="index" class="a-skeleton" />
      </div>
      <PEmpty v-else-if="errorMessage" kicker="" title="加载失败" :description="errorMessage" />
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
          <button class="collection-post-edit" type="button" :aria-label="`编辑《${post.title}》`" @click.stop="editPost(post)">
            <Pencil :size="16" aria-hidden="true" />
            <span>编辑</span>
          </button>
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

.collection-sheet-heading {
  min-width: 0;
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
