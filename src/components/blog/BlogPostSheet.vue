<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pencil } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import type { Post } from '@/types'
import type { BlogPostLayer } from '@/components/blog/blogSheetTypes'

const props = withDefaults(defineProps<{
  layer: BlogPostLayer
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
const { renderMarkdown } = useMarkdownRenderer()

const post = ref<Post | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const renderedContent = computed(() => renderMarkdown(post.value?.content || '', { references: post.value?.references }))
const isOwner = computed(() => authStore.user?.uuid === post.value?.user_id)

async function loadPost() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(api.blog.post(props.layer.payload.postId), {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) throw new Error('load failed')
    const payload = await res.json()
    post.value = payload.data || payload
  } catch {
    post.value = null
    errorMessage.value = '文章加载失败，请重试'
  } finally {
    loading.value = false
  }
}

function editPost() {
  if (!post.value) return
  const query = new URLSearchParams()
  if (post.value.channel_id) query.set('channel', post.value.channel_id)
  if (props.layer.payload.collectionId) query.set('collection', props.layer.payload.collectionId)
  const suffix = query.size ? `?${query.toString()}` : ''
  void router.push(`/posts/post/${post.value.id}/edit${suffix}`)
}

watch(() => props.layer.payload.postId, () => void loadPost(), { immediate: true })
</script>

<template>
  <PSheet
    show
    :title="post?.title || layer.title"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key)"
    :is-top-layer="sheets.isTop(layer.key)"
    width="min(100%, 980px)"
    reading-mode
    close-type="both"
    @close="sheets.closeLayer(layer.key)"
  >
    <template #header>
      <div class="post-sheet-header">
        <span class="a-label a-muted">文章预览</span>
        <PButton v-if="isOwner" variant="secondary" size="sm" @click="editPost">
          <Pencil :size="15" aria-hidden="true" />
          编辑
        </PButton>
      </div>
    </template>

    <div v-if="loading" class="post-sheet-loading" aria-label="正在加载文章">
      <div class="a-skeleton post-sheet-title-skeleton" />
      <div v-for="index in 6" :key="index" class="a-skeleton post-sheet-line-skeleton" />
    </div>
    <PEmpty v-else-if="errorMessage" kicker="" title="加载失败" :description="errorMessage" />
    <article v-else-if="post" class="post-sheet-article">
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.title" class="post-sheet-cover" />
      <div class="post-sheet-meta">
        <span>{{ post.user?.display_name || post.user?.username || '未知作者' }}</span>
        <span>{{ new Date(post.created_at).toLocaleDateString('zh-CN') }}</span>
      </div>
      <h1>{{ post.title }}</h1>
      <p v-if="post.summary" class="post-sheet-summary">{{ post.summary }}</p>
      <div class="prose-blog post-sheet-content" v-html="renderedContent" />
    </article>
  </PSheet>
</template>

<style scoped>
.post-sheet-header,
.post-sheet-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.post-sheet-loading,
.post-sheet-article {
  padding: 2rem 1.5rem 6rem;
}

.post-sheet-title-skeleton {
  width: 75%;
  height: 2.75rem;
  margin-bottom: 2rem;
}

.post-sheet-line-skeleton {
  height: 1rem;
  margin-bottom: 0.75rem;
}

.post-sheet-cover {
  width: 100%;
  max-height: 22rem;
  margin-bottom: 2rem;
  object-fit: cover;
}

.post-sheet-meta {
  justify-content: flex-start;
  color: var(--a-color-muted);
  font-size: 0.8rem;
}

.post-sheet-article h1 {
  margin: 1rem 0;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  line-height: 1.2;
  letter-spacing: 0;
}

.post-sheet-summary {
  margin: 0 0 2rem;
  color: var(--a-color-muted);
  font-size: 1.05rem;
  line-height: 1.7;
}

.post-sheet-content {
  max-width: 46rem;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .post-sheet-loading,
  .post-sheet-article {
    padding: 1.25rem 1rem 5rem;
  }
}
</style>
