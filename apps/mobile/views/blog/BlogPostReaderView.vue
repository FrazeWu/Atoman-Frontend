<template>
  <div class="blog-post-reader" @scroll.passive="updateScrollProgress">
    <!-- Reading Progress Bar -->
    <div
      class="reading-progress-track"
      aria-hidden="true"
    >
      <div
        class="reading-progress-bar"
        data-testid="reading-progress-bar"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <!-- Sticky Top Bar -->
    <header class="blog-reader-topbar">
      <button
        type="button"
        class="blog-reader-topbar__btn"
        data-testid="blog-reader-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" :stroke-width="2" />
      </button>

      <span class="blog-reader-topbar__title">{{ currentPost?.title || '博客文章' }}</span>

      <button
        type="button"
        class="blog-reader-topbar__btn"
        aria-label="分享"
        @click="handleShare"
      >
        <MIcon name="share" size="md" :stroke-width="1.8" />
      </button>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="blog-reader-loading">
      <div class="blog-reader-skeleton-title" />
      <div class="blog-reader-skeleton-author" />
      <div v-for="n in 6" :key="n" class="blog-reader-skeleton-para" />
    </div>

    <!-- Main Content -->
    <main v-else-if="currentPost" class="blog-reader-main">
      <h1 class="blog-reader-title">{{ currentPost.title }}</h1>

      <!-- Author Header -->
      <div class="blog-reader-author-row">
        <MAvatar
          :src="currentPost.author?.avatar"
          :name="currentPost.author?.name || 'Author'"
          :size="36"
          class="blog-reader-author__avatar"
        />
        <div class="blog-reader-author__meta">
          <div class="blog-reader-author__name">{{ currentPost.author?.name || '匿名作者' }}</div>
          <div class="blog-reader-author__sub">
            <span v-if="currentPost.published_at">{{ formatDate(currentPost.published_at) }}</span>
            <span v-if="currentPost.reading_time_minutes" class="blog-reader-author__dot">·</span>
            <span v-if="currentPost.reading_time_minutes">阅读约 {{ currentPost.reading_time_minutes }} 分钟</span>
          </div>
        </div>
      </div>

      <!-- Markdown Render Content -->
      <div
        class="blog-markdown-content"
        data-testid="blog-markdown-content"
        v-html="renderedMarkdown"
      />
    </main>

    <!-- Empty State -->
    <div v-else class="blog-reader-empty" role="alert">
      <p>{{ loadError || '文章不存在或已被删除' }}</p>
      <button v-if="canRetry" type="button" @click="loadPostById(String(route.params.id || ''))">重新加载</button>
      <button type="button" @click="handleBack">返回文章列表</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import { getPostById } from '@/entities/post/api/postApi'
import { ApiErrorResponseError } from '@/api/client'

export interface BlogPostDetailData {
  id: string
  title: string
  content?: string
  author?: {
    name: string
    avatar?: string
  }
  published_at?: string
  reading_time_minutes?: number
}

const props = withDefaults(
  defineProps<{
    post?: BlogPostDetailData
  }>(),
  {
    post: undefined,
  }
)

const route = useRoute()
const router = useRouter()

const loadedPost = ref<BlogPostDetailData | null>(null)
const loading = ref(false)
const loadError = ref('')
const canRetry = ref(false)
const progressPercent = ref(0)

const currentPost = computed(() => props.post || loadedPost.value)

const renderedMarkdown = computed(() => {
  const raw = currentPost.value?.content || ''
  if (!raw) return ''
  try {
    const html = marked.parse(raw, { async: false }) as string
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      return DOMPurify.sanitize(html)
    }
    return html
  } catch {
    return raw
  }
})

function handleBack() {
  router.back()
}

function handleShare() {
  if (navigator.share && currentPost.value) {
    void navigator.share({
      title: currentPost.value.title,
      url: window.location.href,
    }).catch(() => {})
  }
}

function formatDate(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return ''
  }
}

function updateScrollProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  const scrollHeight = (document.documentElement.scrollHeight || document.body.scrollHeight || 1) - window.innerHeight
  if (scrollHeight <= 0) {
    progressPercent.value = 100
  } else {
    progressPercent.value = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)))
  }
}

async function loadPostById(id: string) {
  if (props.post) return
  loading.value = true
  loadError.value = ''
  canRetry.value = false
  try {
    const res = await getPostById(id)
    if (res) {
      const words = (res.content || '').length
      const mins = Math.max(1, Math.round(words / 400))
      loadedPost.value = {
        id: String(res.id),
        title: res.title,
        content: res.content || '',
        author: {
          name: res.author?.nickname || res.author?.username || res.user?.display_name || res.user?.username || '作者',
          avatar: res.author?.avatar || res.user?.avatar_url || '',
        },
        published_at: res.published_at || res.created_at,
        reading_time_minutes: mins,
      }
    }
  } catch (error) {
    loadedPost.value = null
    const notFound = error instanceof ApiErrorResponseError && error.status === 404
    loadError.value = notFound ? '文章不存在或已被删除' : '文章加载失败，请检查网络后重试'
    canRetry.value = !notFound
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.post && route.params.id) {
    void loadPostById(String(route.params.id))
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateScrollProgress)
})
</script>

<style scoped>
.blog-post-reader {
  min-height: 100vh;
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
  padding-bottom: 80px;
}

.reading-progress-track {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
  z-index: 30;
}

.reading-progress-bar {
  height: 100%;
  background-color: var(--a-color-primary, #0066cc);
  transition: width 0.1s ease;
}

.blog-reader-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(48px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: 8px;
  padding-right: 8px;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.blog-reader-topbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.blog-reader-topbar__btn:active {
  background-color: var(--a-color-surface-muted, #f1f5f9);
}

.blog-reader-topbar__title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
  text-align: center;
}

.blog-reader-main {
  padding: 24px 18px 48px;
  max-width: 680px;
  margin: 0 auto;
}

.blog-reader-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--a-color-text, #0f172a);
  margin: 0 0 16px 0;
  letter-spacing: -0.015em;
}

.blog-reader-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f5f9);
}

.blog-reader-author__avatar {
  border-radius: 4px;
}

.blog-reader-author__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.blog-reader-author__sub {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--a-color-muted, #64748b);
  margin-top: 2px;
}

.blog-reader-author__dot {
  color: var(--a-color-muted, #94a3b8);
}

.blog-markdown-content {
  font-size: 16px;
  line-height: 1.8;
  color: #1e293b;
  word-break: break-word;
}

.blog-markdown-content :deep(h1),
.blog-markdown-content :deep(h2),
.blog-markdown-content :deep(h3),
.blog-markdown-content :deep(h4) {
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin-top: 1.5em;
  margin-bottom: 0.6em;
  line-height: 1.3;
}

.blog-markdown-content :deep(h2) {
  font-size: 19px;
}

.blog-markdown-content :deep(h3) {
  font-size: 17px;
}

.blog-markdown-content :deep(p) {
  margin-top: 0;
  margin-bottom: 1.25em;
}

.blog-markdown-content :deep(ul),
.blog-markdown-content :deep(ol) {
  padding-left: 20px;
  margin-bottom: 1.25em;
}

.blog-markdown-content :deep(li) {
  margin-bottom: 0.35em;
}

.blog-markdown-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88em;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  padding: 2px 5px;
  border-radius: 4px;
}

.blog-markdown-content :deep(pre) {
  background-color: #0f172a;
  color: #f8fafc;
  padding: 12px 14px;
  border-radius: var(--a-radius-card, 4px);
  overflow-x: auto;
  margin-bottom: 1.25em;
}

.blog-markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
  font-size: 13px;
}

.blog-markdown-content :deep(blockquote) {
  border-left: 3px solid var(--a-color-border, #cbd5e1);
  margin: 1.2em 0;
  padding-left: 14px;
  color: var(--a-color-muted, #64748b);
  font-style: italic;
}

.blog-markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--a-radius-card, 4px);
  margin: 1em 0;
}

.blog-reader-loading,
.blog-reader-empty {
  padding: 40px 20px;
  text-align: center;
}

.blog-reader-skeleton-title {
  height: 30px;
  width: 75%;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
  margin-bottom: 16px;
}

.blog-reader-skeleton-author {
  height: 36px;
  width: 45%;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
  margin-bottom: 24px;
}

.blog-reader-skeleton-para {
  height: 16px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  border-radius: 4px;
  margin-bottom: 12px;
}
</style>
