<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, ref, watch } from 'vue'
import { Pencil } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import BlogPostUpdateNotice from '@/components/blog/BlogPostUpdateNotice.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
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
const feedStore = useFeedStore()
const channelSubscribed = ref(false)
const channelSubscriptionBusy = ref(false)
const ratingLoading = ref(false)

async function loadPost() {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await apiRequestResult(api.blog.post(props.layer.payload.postId), {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) throw new Error('load failed')
    const payload = await Promise.resolve(res.data)
    post.value = payload.data || payload
    if (authStore.isAuthenticated && post.value?.channel_id) {
      channelSubscribed.value = await feedStore.isSubscribedToChannel(post.value.channel_id)
    } else {
      channelSubscribed.value = false
    }
  } catch {
    post.value = null
    errorMessage.value = '文章加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function toggleChannelSubscription() {
  if (!post.value?.channel_id || !authStore.isAuthenticated || channelSubscriptionBusy.value) return
  channelSubscriptionBusy.value = true
  try {
    const success = channelSubscribed.value
      ? await feedStore.unsubscribeFromChannel(post.value.channel_id)
      : await feedStore.subscribeToChannel(post.value.channel_id)
    if (success) channelSubscribed.value = !channelSubscribed.value
  } finally {
    channelSubscriptionBusy.value = false
  }
}

async function ratePost(score: number) {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.value.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) return
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? post.value.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? post.value.rating_count ?? 0)
    post.value.viewer_rating = Number(summary.viewer_rating ?? score)
  } finally {
    ratingLoading.value = false
  }
}

async function clearRating() {
  if (!post.value || !authStore.isAuthenticated || ratingLoading.value) return
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.value.id), {
      method: 'DELETE',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!res.ok) return
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? 0)
    post.value.viewer_rating = undefined
  } finally {
    ratingLoading.value = false
  }
}

function editPost() {
  if (!post.value) return
  const query = new URLSearchParams()
  if (post.value.channel_id) query.set('channel', post.value.channel_id)
  if (props.layer.payload.collectionId) query.set('collection', props.layer.payload.collectionId)
  const suffix = query.size ? `?${query.toString()}` : ''
  void router.push(`/studio/blog/${post.value.id}/edit${suffix}`)
}

watch(() => props.layer.payload.postId, () => void loadPost(), { immediate: true })
</script>

<template>
  <PSheet
    :show="sheets.isActive(layer.key)"
    :title="post?.title || layer.title"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key)"
    :is-top-layer="sheets.isTop(layer.key)"
    reading-mode
    close-type="both"
    @close="sheets.closeLayer(layer.key)"
    @activate="sheets.returnToLayer(layer.key)"
  >
    <div v-if="loading" class="post-sheet-loading" aria-label="正在加载文章">
      <div class="a-skeleton post-sheet-title-skeleton" />
      <div v-for="index in 6" :key="index" class="a-skeleton post-sheet-line-skeleton" />
    </div>
    <PEmpty v-else-if="errorMessage" kicker="" title="加载失败" :description="errorMessage" />
    <article v-else-if="post" class="post-sheet-article">
      <div v-if="isOwner" class="post-sheet-actions">
        <PButton variant="secondary" size="sm" @click="editPost">
          <Pencil :size="15" aria-hidden="true" />
          编辑
        </PButton>
      </div>
      <img v-if="post.cover_url" :src="post.cover_url" :alt="post.title" class="post-sheet-cover" />
      <div class="post-sheet-meta">
        <span>{{ post.user?.display_name || post.user?.username || '未知作者' }}</span>
        <span>{{ new Date(post.created_at).toLocaleDateString('zh-CN') }}</span>
        <button
          v-if="post.channel_id && authStore.isAuthenticated"
          type="button"
          class="post-sheet-subscribe"
          :class="{ 'is-subscribed': channelSubscribed }"
          :disabled="channelSubscriptionBusy"
          @click="toggleChannelSubscription"
        >
          {{ channelSubscribed ? '已订阅频道' : '订阅频道' }}
        </button>
        <RouterLink v-else-if="post.channel_id" to="/login" class="post-sheet-subscribe">登录后订阅频道</RouterLink>
      </div>
      <h1>{{ post.title }}</h1>
      <p v-if="post.summary" class="post-sheet-summary">{{ post.summary }}</p>
      <BlogPostUpdateNotice :updated-at="post.updated_at" />
      <div class="prose-blog post-sheet-content" v-html="renderedContent" />
      <PostRatingControl
        :rating-score="post.rating_score"
        :rating-count="post.rating_count"
        :viewer-rating="post.viewer_rating"
        :disabled="!authStore.isAuthenticated"
        :loading="ratingLoading"
        @rate="ratePost"
        @clear="clearRating"
      />
    </article>
  </PSheet>
</template>

<style scoped>
.post-sheet-actions,
.post-sheet-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.post-sheet-actions {
  justify-content: flex-end;
  margin-bottom: 1rem;
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

.post-sheet-subscribe {
  margin-left: auto;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-fg);
  font-size: 0.78rem;
  cursor: pointer;
  text-decoration: none;
}

.post-sheet-subscribe.is-subscribed {
  color: var(--a-color-success);
  border-color: color-mix(in srgb, var(--a-color-success) 45%, var(--a-color-border-soft));
}

.post-sheet-subscribe:disabled {
  cursor: wait;
  opacity: 0.6;
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
