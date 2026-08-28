<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, ref, watch } from 'vue'
import { Bookmark, Clock, Pencil } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PostRatingControl from '@/components/blog/PostRatingControl.vue'
import BlogPostUpdateNotice from '@/components/blog/BlogPostUpdateNotice.vue'
import BlogRelatedPosts, { type BlogRelatedPost } from '@/components/blog/BlogRelatedPosts.vue'
import { useApi } from '@/composables/useApi'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import { useAuthStore } from '@/stores/auth'
import { useContentLifecycle } from '@/composables/useContentLifecycle'
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
const lifecycle = useContentLifecycle()
const { renderMarkdown } = useMarkdownRenderer()

const post = ref<Post | null>(null)
const relatedPosts = ref<BlogRelatedPost[]>([])
const loading = ref(false)
const errorMessage = ref('')
const renderedContent = computed(() => renderMarkdown(post.value?.content || '', { references: post.value?.references }))
const isOwner = computed(() => authStore.user?.uuid === post.value?.user_id)
const feedStore = useFeedStore()
const channelSubscribed = ref(false)
const channelSubscriptionBusy = ref(false)
const ratingLoading = ref(false)
const ratingError = ref('')
let loadSequence = 0
let relatedRequestSequence = 0

async function loadPost() {
  const requestedPostId = props.layer.payload.postId
  const requestSequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  post.value = null
  relatedPosts.value = []
  relatedRequestSequence += 1
  channelSubscribed.value = false
  channelSubscriptionBusy.value = false
  try {
    const res = await apiRequestResult(api.blog.post(requestedPostId), {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
    if (!res.ok) throw new Error('load failed')
    const payload = await Promise.resolve(res.data)
    if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
    const loadedPost = (payload.data || payload) as Post
    post.value = loadedPost
    void lifecycle.recordEvent({
      module: 'blog',
      content_id: loadedPost.id,
      event: 'open',
      source: 'blog_sheet',
    }).catch(() => undefined)
    void loadRelatedPosts(requestedPostId)
    if (authStore.isAuthenticated && post.value?.channel_id) {
      const nextSubscribed = await feedStore.isSubscribedToChannel(post.value.channel_id)
      if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
      channelSubscribed.value = nextSubscribed
    }
  } catch {
    if (requestSequence !== loadSequence || requestedPostId !== props.layer.payload.postId) return
    post.value = null
    errorMessage.value = '文章加载失败，请重试'
  } finally {
    if (requestSequence === loadSequence && requestedPostId === props.layer.payload.postId) loading.value = false
  }
}

async function loadRelatedPosts(postID: string) {
  const requestSequence = ++relatedRequestSequence
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    const res = await apiRequestResult(`${api.blog.relatedPosts(postID)}?limit=6`, { headers })
    if (requestSequence !== relatedRequestSequence || postID !== props.layer.payload.postId || !res.ok) return
    const payload = await Promise.resolve(res.data) as unknown
    const items = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : []
    relatedPosts.value = items.filter((item): item is BlogRelatedPost => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Partial<BlogRelatedPost>
      return typeof candidate.id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.target_path === 'string'
    })
  } catch {
    if (requestSequence === relatedRequestSequence && postID === props.layer.payload.postId) relatedPosts.value = []
  }
}

function openRelatedPost(item: BlogRelatedPost) {
  sheets.openPost(item.id, item.title)
}

const bookmarked = computed(() => Boolean(post.value?.id && feedStore.bookmarkedPostIds.has(post.value.id)))
const inReadingList = computed(() => Boolean(post.value?.id && feedStore.readingListItemIds.has(post.value.id)))

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
  ratingError.value = ''
  ratingLoading.value = true
  try {
    const res = await apiRequestResult(api.blog.postRating(post.value.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}) },
      body: JSON.stringify({ score }),
    })
    if (!res.ok) {
      ratingError.value = '评分未保存，请重试'
      return
    }
    const payload = await Promise.resolve(res.data)
    const summary = payload.data || payload
    post.value.rating_score = Number(summary.rating_score ?? post.value.rating_score ?? 0)
    post.value.rating_count = Number(summary.rating_count ?? post.value.rating_count ?? 0)
    post.value.viewer_rating = Number(summary.viewer_rating ?? score)
  } finally {
    ratingLoading.value = false
  }
}

async function toggleBookmark() {
  if (!post.value || !authStore.isAuthenticated) return
  await feedStore.togglePostBookmark(post.value.id)
}

async function toggleReadingList() {
  if (!post.value || !authStore.isAuthenticated) return
  await feedStore.toggleReadingListItem(post.value.id)
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
    :title="`文章-${post?.title || layer.title || '未命名'}`"
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
    <PEmpty v-else-if="errorMessage" kicker="" title="加载失败" :description="errorMessage">
      <template #action>
        <PButton variant="secondary" size="sm" @click="loadPost">重试</PButton>
      </template>
    </PEmpty>
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
        :viewer-rating="post.viewer_rating"
        :weighted-rating-score="post.weighted_rating_score"
        :weighted-rating-count="post.weighted_rating_count"
        :weighted-rating-active="post.weighted_rating_active"
        :disabled="!authStore.isAuthenticated"
        :loading="ratingLoading"
        :error-message="ratingError"
        @rate="ratePost"
      />
      <div class="post-sheet-actions-row">
        <PButton
          variant="secondary"
          size="sm"
          :disabled="!authStore.isAuthenticated"
          @click="toggleBookmark"
        >
          <Bookmark :size="15" aria-hidden="true" />
          {{ bookmarked ? '取消收藏' : '收藏' }}
        </PButton>
        <PButton
          variant="secondary"
          size="sm"
          :disabled="!authStore.isAuthenticated"
          @click="toggleReadingList"
        >
          <Clock :size="15" aria-hidden="true" />
          {{ inReadingList ? '取消稍后阅读' : '稍后阅读' }}
        </PButton>
      </div>
      <BlogRelatedPosts :items="relatedPosts" @select="openRelatedPost" />
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

.post-sheet-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
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
