<template>
  <div style="padding-bottom:12rem">
    <!-- Loading -->
    <div v-if="loading" class="a-page-md" style="padding-top:4rem">
      <div class="a-skeleton" style="height:3rem;width:75%;margin-bottom:1rem" />
      <div class="a-skeleton" style="height:1rem;width:33%;margin-bottom:1.5rem" />
      <div class="a-skeleton" style="aspect-ratio:16/9;margin-bottom:1.5rem" />
      <div v-for="i in 5" :key="i" class="a-skeleton" style="height:1rem;margin-bottom:.75rem" />
    </div>

    <!-- Not found -->
    <div v-else-if="errorStatus === 404" class="a-page-md" style="padding-top:6rem;text-align:center">
      <p style="font-size:3rem;font-weight:900;color:var(--a-color-disabled-border);margin-bottom:1rem">404</p>
      <p class="a-muted" style="margin-bottom:1.5rem">文章不存在</p>
      <RouterLink to="/" class="a-link">← 返回文章</RouterLink>
    </div>

    <!-- Draft (only visible to owner) -->
    <div v-else-if="errorStatus === 403" class="a-page-md" style="padding-top:6rem;text-align:center">
      <p style="font-size:3rem;font-weight:900;color:var(--a-color-disabled-border);margin-bottom:1rem">草稿</p>
      <p class="a-muted" style="margin-bottom:1.5rem">该文章尚未发布，请登录后查看或编辑</p>
      <RouterLink :to="`/post/${postId}/edit`" class="a-link">去编辑 →</RouterLink>
    </div>

    <!-- Post content -->
    <article v-else-if="post">
      <!-- Cover image -->
      <div v-if="post.cover_url" style="width:100%;max-height:20rem;overflow:hidden">
        <img :src="post.cover_url" :alt="post.title" style="width:100%;object-fit:cover;max-height:20rem" />
      </div>

      <div :class="isAcademic ? 'a-page' : 'a-page-md'" style="padding-top:3rem; transition: max-width 0.3s ease;">
        <!-- Breadcrumb -->
        <RouterLink to="/" class="a-link">← 文章</RouterLink>

        <!-- Title -->
        <h1 
          :class="isAcademic ? 'academic-title' : 'a-title'" 
          :style="!isAcademic ? 'margin-top:1.5rem;margin-bottom:1rem' : ''"
        >
          {{ post.title }}
        </h1>

        <!-- Meta -->
        <div :class="isAcademic ? 'academic-meta' : 'normal-meta'">
          <template v-if="isAcademic">
            <span class="academic-author">{{ post.user?.display_name || post.user?.username }}</span>
            <span class="academic-date">{{ formatDate(post.created_at) }}</span>
            <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem">
              <button 
                @click="isAcademic = false" 
                class="a-btn a-btn--sm a-btn--secondary"
                style="border-radius: var(--a-radius-none); font-weight: 700; height: 1.85rem; min-height: auto; padding: 0.25rem 0.75rem;"
              >
                📖 极简单栏
              </button>
              <RouterLink v-if="isOwner" :to="`/post/${post.id}/edit`" class="a-btn a-btn--sm a-btn--primary" style="border-radius: var(--a-radius-none); height: 1.85rem; min-height: auto; padding: 0.25rem 0.75rem;">编辑</RouterLink>
            </div>
          </template>
          <template v-else>
            <a :href="userUrl(post.user?.username || '')" style="display:flex;align-items:center;gap:.5rem;text-decoration:none">
              <div style="width:2rem;height:2rem;border-radius:var(--a-radius-none);background:var(--a-color-fg);display:flex;align-items:center;justify-content:center;color:var(--a-color-bg);font-weight:900;font-size:.75rem">
                {{ (post.user?.display_name || post.user?.username || '?').charAt(0).toUpperCase() }}
              </div>
              <span style="font-weight:900;font-size:.875rem">{{ post.user?.display_name || post.user?.username }}</span>
            </a>
            <span class="a-label a-muted">{{ formatDate(post.created_at) }}</span>
            <div style="margin-left:auto; display:flex; gap:0.5rem; align-items:center;">
              <button 
                @click="isAcademic = true" 
                class="a-btn a-btn--sm a-btn--secondary"
                style="border-radius: var(--a-radius-none); font-weight: 700; height: 1.85rem; min-height: auto; padding: 0.25rem 0.75rem;"
              >
                🔬 学术双栏
              </button>
              <RouterLink v-if="isOwner" :to="`/post/${post.id}/edit`" class="a-btn a-btn--sm a-btn--primary" style="border-radius: var(--a-radius-none); height: 1.85rem; min-height: auto; padding: 0.25rem 0.75rem;">编辑</RouterLink>
            </div>
          </template>
        </div>

        <!-- Abstract -->
        <div v-if="isAcademic && post.summary" class="academic-abstract">
          <h3 class="abstract-title">摘要</h3>
          <p class="abstract-content">{{ post.summary }}</p>
        </div>

        <!-- Markdown content -->
        <div 
          class="prose-blog" 
          :class="{ 'prose-blog-academic': isAcademic }" 
          style="margin-bottom:3rem" 
          v-html="renderedContent" 
        />

        <!-- Interaction bar -->
        <div style="display:flex;align-items:center;gap:1rem;padding:1.5rem 0;margin-bottom:3rem">
          <button
            @click="toggleLike"
            class="a-toggle-btn"
            :class="{ 'a-toggle-btn-active': liked }"
          >
            ♥ {{ likesCount }}
          </button>
          <a
            v-if="post.user?.username"
            :href="api.feed.rss(post.user.username)"
            target="_blank"
            class="a-link"
            style="margin-left:auto"
          >
            RSS ↗
          </a>
        </div>

        <!-- Comments -->
        <CommentSection
          :target="{ kind: 'blog_post', resourceId: post.id }"
        />
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CommentSection from '@/components/comment/CommentSection.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { userUrl } from '@/composables/useSubdomainNav'
import { useApi } from '@/composables/useApi'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import type { Post } from '@/types'
import { useSheetStore } from '@/stores/sheet'

type EmbedData = {
  id: string
  title: string
  summary?: string
  meta?: string
  href?: string
}

const props = defineProps<{
  id?: string
}>()

const route = useRoute()
const sheetStore = useSheetStore()

const postId = computed(() => props.id || String(route.params.id || ''))
const authStore = useAuthStore()
const api = useApi()
const { renderMarkdown } = useMarkdownRenderer()

const post = ref<Post | null>(null)
const isAcademic = ref(false)
const loading = ref(true)
const errorStatus = ref<number | null>(null)
const liked = ref(false)
const likesCount = ref(0)
const bookmarked = ref(false)
const showUnbookmarkConfirm = ref(false)
const postEmbeds = ref<Record<string, EmbedData>>({})
const musicEmbeds = ref<Record<string, EmbedData>>({})
const videoEmbeds = ref<Record<string, EmbedData>>({})

const isOwner = computed(() => authStore.user?.uuid === post.value?.user_id)

const formatDate = (d: string) => new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

const normalizeTitleText = (text: string) => text.trim().replace(/\s+/g, ' ')

const stripLeadingDuplicateHeading = (content: string, title: string) => {
  const lines = content.split('\n')
  if (!lines.length) return content

  const firstLine = lines[0]?.trim() || ''
  const match = firstLine.match(/^#{1,6}\s+(.+)$/)
  if (!match) return content

  const headingText = normalizeTitleText(match[1])
  const postTitle = normalizeTitleText(title)
  if (!headingText || !postTitle || headingText !== postTitle) return content

  let startIndex = 1
  while (startIndex < lines.length && lines[startIndex].trim() === '') {
    startIndex++
  }

  return lines.slice(startIndex).join('\n')
}

const renderedContent = computed(() => {
  const content = post.value?.content ?? ''
  const title = post.value?.title ?? ''
  return renderMarkdown(stripLeadingDuplicateHeading(content, title), {
    postEmbeds: postEmbeds.value,
    musicEmbeds: musicEmbeds.value,
    videoEmbeds: videoEmbeds.value,
  })
})

const fetchPost = async () => {
  loading.value = true
  errorStatus.value = null
  try {
    const id = postId.value
    if (!id) {
      errorStatus.value = 404
      return
    }
    const headers: Record<string, string> = {}
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`
    const res = await fetch(api.blog.post(id), { headers })
    if (res.ok) {
      const d = await res.json()
      post.value = d.data || d
      likesCount.value = post.value?.likes_count ?? 0

      if (post.value?.channel_id) {
        void fetch(`${api.url}/feed/events/read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
          },
          body: JSON.stringify({
            source_type: 'internal_channel',
            source_id: post.value.channel_id,
            event_type: 'detail_open',
          }),
        })
      }

      if (post.value) {
        await fetchEmbeds(post.value.content)
      }

      // Initialize bookmark state
      if (authStore.isAuthenticated && post.value) {
        fetchBookmarkState(post.value.id)
      }

      if (props.id && post.value) {
        sheetStore.updateSheetTitle(props.id, 'post', post.value.title)
      }
    } else {
      errorStatus.value = res.status
    }
  } catch (e) {
    console.error(e)
    errorStatus.value = 500
  } finally {
    loading.value = false
  }
}

watch(postId, () => {
  fetchPost()
})

const fetchBookmarkState = async (postId: string) => {
  try {
    const res = await fetch(api.blog.bookmarks, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (res.ok) {
      const d = await res.json()
      const items = d.data || []
      bookmarked.value = items.some((b: { post_id: string }) => b.post_id === postId)
    }
  } catch (e) { console.error(e) }
}

const extractEmbedIds = (content: string, kind: 'post' | 'music' | 'video') => {
  const patternMap = {
    post: /:::post\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    music: /:::music\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
    video: /:::video\{id="([0-9a-fA-F-]{36})"\}\s*:::/g,
  }

  const matches = content.matchAll(patternMap[kind])
  return [...new Set(Array.from(matches, (match) => match[1]))]
}

const authHeaders = () => {
  const headers: Record<string, string> = {}
  if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`
  return headers
}

const fetchPostEmbeds = async (content: string) => {
  const ids = extractEmbedIds(content, 'post')
  if (!ids.length) {
    postEmbeds.value = {}
    return
  }

  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(api.blog.post(id), { headers: authHeaders() })
        if (!res.ok) return null
        const payload = await res.json()
        const embedPost = (payload.data || payload) as Post
        return [
          id,
          {
            id,
            title: embedPost.title,
            summary: embedPost.summary,
            meta: embedPost.channel?.name,
            href: `/post/${id}`,
          } satisfies EmbedData,
        ] as const
      } catch {
        return null
      }
    }),
  )

  postEmbeds.value = Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

const fetchMusicEmbeds = async (content: string) => {
  const ids = extractEmbedIds(content, 'music')
  if (!ids.length) {
    musicEmbeds.value = {}
    return
  }

  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(api.v1.music.album(id), { headers: authHeaders() })
        if (!res.ok) return null
        const payload = await res.json()
        const album = (payload.data || payload) as import('@/types').Album
        return [
          id,
          {
            id,
            title: album.title,
            summary: album.release_date ? `发行日期：${album.release_date}` : undefined,
            meta: [album.artists?.map((artist) => artist.name).join(' / '), album.year ? String(album.year) : ''].filter(Boolean).join(' · '),
            href: `/music/albums/${id}`,
          } satisfies EmbedData,
        ] as const
      } catch {
        return null
      }
    }),
  )

  musicEmbeds.value = Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

const fetchVideoEmbeds = async (content: string) => {
  const ids = extractEmbedIds(content, 'video')
  if (!ids.length) {
    videoEmbeds.value = {}
    return
  }

  videoEmbeds.value = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        id,
        title: '引用视频',
        summary: '视频模块尚未接入真实数据源，当前为可扩展占位。',
        href: `#video-${id}`,
      } satisfies EmbedData,
    ]),
  )
}

const fetchEmbeds = async (content: string) => {
  await Promise.all([fetchPostEmbeds(content), fetchMusicEmbeds(content), fetchVideoEmbeds(content)])
}

const toggleLike = async () => {
  if (!authStore.isAuthenticated || !post.value) return
  const method = liked.value ? 'DELETE' : 'POST'
  try {
    const res = await fetch(api.blog.likes, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({ target_type: 'post', target_id: post.value.id })
    })
    if (res.ok) {
      liked.value = !liked.value
      likesCount.value += liked.value ? 1 : -1
    }
  } catch (e) {
    console.error(e)
  }
}

onMounted(fetchPost)
</script>

<style scoped>
.prose-blog :deep(h1),
.prose-blog :deep(h2),
.prose-blog :deep(h3),
.prose-blog :deep(h4) {
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 2rem 0 1rem;
  line-height: 1.25;
}
.prose-blog :deep(h1) { font-size: 2rem; }
.prose-blog :deep(h2) { font-size: 1.5rem; border-left: 2px solid var(--a-color-fg); padding-left: 0.75rem; }
.prose-blog :deep(h3) { font-size: 1.2rem; }
.prose-blog :deep(p) { margin: 1rem 0; line-height: 1.8; font-size: 1.05rem; color: var(--a-color-fg); }
.prose-blog :deep(a) { font-weight: 700; text-decoration: underline; }
.prose-blog :deep(a:hover) { opacity: 0.7; }
.prose-blog :deep(code) {
  background: var(--a-color-disabled-bg);
  border: 1px solid var(--a-color-disabled-border);
  padding: 0.15em 0.4em;
  font-size: 0.9em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.prose-blog :deep(pre) {
  background: #1e1e2e;
  color: #cdd6f4;
  padding: 1.25rem;
  border: var(--a-border);
  overflow-x: auto;
  margin: 1.5rem 0;
}
.prose-blog :deep(pre code) { background: none; border: none; padding: 0; color: inherit; }
.prose-blog :deep(blockquote) {
  border-left: 2px solid var(--a-color-fg);
  padding: 0.5rem 1.25rem;
  margin: 1.5rem 0;
  font-style: italic;
  color: var(--a-color-muted);
  background: var(--a-color-paper-soft);
}
.prose-blog :deep(ul), .prose-blog :deep(ol) {
  padding-left: 1.5rem;
  margin: 1rem 0;
  line-height: 1.8;
}
.prose-blog :deep(li) { margin: 0.4rem 0; }
.prose-blog :deep(img) { border: var(--a-border); width: 100%; margin: 1.5rem 0; }
.prose-blog :deep(hr) { border: 0; border-top: var(--a-border); margin: 2rem 0; }
.prose-blog :deep(table) { border-collapse: collapse; width: 100%; margin: 1.5rem 0; }
.prose-blog :deep(th), .prose-blog :deep(td) { border: var(--a-border); padding: 0.6rem 1rem; }
.prose-blog :deep(th) { background: var(--a-color-fg); color: var(--a-color-bg); font-weight: 700; text-align: left; }

/* KaTeX math rendering */
.prose-blog :deep(.katex-display) { margin: 1.5rem 0; overflow-x: auto; }
.prose-blog :deep(.katex) { font-size: 1.05rem; }

/* highlight.js code theme (inside dark pre) */
.prose-blog :deep(.hljs-keyword),
.prose-blog :deep(.hljs-built_in) { color: #ff79c6; }
.prose-blog :deep(.hljs-string) { color: #f1fa8c; }
.prose-blog :deep(.hljs-number) { color: #bd93f9; }
.prose-blog :deep(.hljs-comment) { color: #6272a4; font-style: italic; }
.prose-blog :deep(.hljs-function),
.prose-blog :deep(.hljs-title) { color: #50fa7b; }
.prose-blog :deep(.hljs-variable),
.prose-blog :deep(.hljs-attr) { color: #8be9fd; }


.prose-blog :deep(.atoman-post-embed) {
  margin: 1.5rem 0;
}
.prose-blog :deep(.atoman-post-embed__link) {
  display: block;
  border: var(--a-border);
  padding: 1rem 1.25rem;
  text-decoration: none;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
}
.prose-blog :deep(.atoman-post-embed__link:hover) {
  box-shadow: var(--a-shadow-dropdown);
}
.prose-blog :deep(.atoman-post-embed__label) {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--a-color-muted);
  margin-bottom: 0.5rem;
}
.prose-blog :deep(.atoman-post-embed__title) {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 0.4rem;
}
.prose-blog :deep(.atoman-post-embed__summary) {
  font-size: 0.875rem;
  color: var(--a-color-muted);
  line-height: 1.6;
}
.prose-blog :deep(.atoman-post-embed__meta) {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--a-color-muted);
}

/* Like / toggle button */
.a-toggle-btn {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--a-letter-spacing-wide);
  padding: 0.4rem 0.875rem;
  border: var(--a-border);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  transition: all 0.15s;
}

.a-toggle-btn:hover {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.a-toggle-btn-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.a-toggle-btn-active:hover {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

@media (max-width: 639px) {
  .prose-blog :deep(pre) { padding: 1rem; font-size: 0.8rem; }
  .prose-blog :deep(h2) { font-size: 1.25rem; }
}

/* ─── Academic Header Styles ───────────────────────────────────────────── */
.academic-title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 2.25rem;
  font-weight: 800;
  text-align: center;
  margin-top: 2.5rem;
  margin-bottom: 1.5rem;
  letter-spacing: -0.03em;
  color: var(--a-color-fg);
  line-height: 1.2;
}

.normal-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: none;
  margin-bottom: 2.5rem;
}

.academic-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding-bottom: 2rem;
  border-bottom: none;
  margin-bottom: 2.5rem;
  text-align: center;
}

.academic-author {
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif;
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--a-color-fg);
}

.academic-date {
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif;
  font-size: 0.85rem;
  color: var(--a-color-muted);
}

.academic-abstract {
  max-width: 80%;
  margin: 0 auto 3rem auto;
  text-align: justify;
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif;
  line-height: 1.62;
  padding: 1.25rem 1.75rem;
  background: var(--a-color-paper-soft);
  border: 1px solid var(--a-color-line-soft);
  border-radius: 8px;
}

.abstract-title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.9rem;
  font-weight: 800;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 0.5rem;
  letter-spacing: 0.08em;
}

.abstract-content {
  font-size: 0.9rem;
  color: var(--a-color-fg);
  margin: 0;
}

/* ─── Academic Two-Column (NIPS/NeurIPS style) ───────────────────────────── */
.prose-blog-academic {
  column-count: 2;
  column-gap: 3rem;
  column-rule: 1px solid var(--a-color-line-soft);
  text-align: justify;
  text-justify: inter-word;
  font-family: "Times New Roman", Times, Georgia, "Liberation Serif", serif !important;
  font-size: 0.95rem !important;
  line-height: 1.65 !important;
}

/* Adjust heading styles in academic mode */
.prose-blog-academic :deep(h1),
.prose-blog-academic :deep(h2),
.prose-blog-academic :deep(h3),
.prose-blog-academic :deep(h4) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  break-after: avoid;
  break-inside: avoid;
  margin-top: 1.5rem !important;
  margin-bottom: 0.75rem !important;
  font-weight: 800 !important;
  letter-spacing: -0.01em !important;
}

.prose-blog-academic :deep(h1) {
  font-size: 1.4rem !important;
  text-align: center;
  margin-top: 2rem !important;
  margin-bottom: 1rem !important;
  column-span: all;
}

.prose-blog-academic :deep(h2) {
  font-size: 1.15rem !important;
  border-left: none !important;
  padding-left: 0 !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--a-color-fg) !important;
  padding-bottom: 0.15rem !important;
}

.prose-blog-academic :deep(h3) {
  font-size: 1.02rem !important;
  font-style: italic;
  font-weight: 700;
}

.prose-blog-academic :deep(p) {
  font-size: 0.95rem !important;
  margin: 0 0 1rem 0 !important;
  text-indent: 1.5rem;
  line-height: 1.65 !important;
}

/* Do not indent the very first paragraph after a heading or blockquotes/pre/table */
.prose-blog-academic :deep(h2) + :deep(p),
.prose-blog-academic :deep(h3) + :deep(p),
.prose-blog-academic :deep(h4) + :deep(p),
.prose-blog-academic :deep(p):first-of-type,
.prose-blog-academic :deep(blockquote) + :deep(p),
.prose-blog-academic :deep(pre) + :deep(p) {
  text-indent: 0 !important;
}

/* Block elements break prevention */
.prose-blog-academic :deep(blockquote) {
  break-inside: avoid;
  border-left: 3px double var(--a-color-fg) !important;
  background: var(--a-color-paper-soft) !important;
  padding: 0.75rem 1rem !important;
  margin: 1.25rem 0 !important;
  font-family: inherit !important;
  font-style: italic;
  text-indent: 0 !important;
}

.prose-blog-academic :deep(pre) {
  break-inside: avoid;
  margin: 1.25rem 0 !important;
  font-size: 0.82rem !important;
  text-indent: 0 !important;
}

.prose-blog-academic :deep(table) {
  break-inside: avoid;
  margin: 1.5rem 0 !important;
  font-size: 0.82rem !important;
  border-top: 2px solid var(--a-color-fg) !important;
  border-bottom: 2px solid var(--a-color-fg) !important;
  border-collapse: collapse;
}

.prose-blog-academic :deep(th) {
  border: none !important;
  border-bottom: 1px solid var(--a-color-fg) !important;
  background: none !important;
  color: var(--a-color-fg) !important;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.72rem;
  padding: 0.4rem 0.5rem !important;
}

.prose-blog-academic :deep(td) {
  border: none !important;
  border-bottom: 1px solid var(--a-color-line-soft) !important;
  padding: 0.4rem 0.5rem !important;
}

.prose-blog-academic :deep(tr):last-child :deep(td) {
  border-bottom: none !important;
}

.prose-blog-academic :deep(img) {
  break-inside: avoid;
  max-width: 100%;
  border: 1px solid var(--a-color-line-soft) !important;
}

.prose-blog-academic :deep(hr) {
  column-span: all;
  border: none;
  border-top: 1px solid var(--a-color-fg);
  margin: 2rem 0;
}

@media (max-width: 768px) {
  .prose-blog-academic {
    column-count: 1 !important;
    column-gap: 0;
  }
  .academic-abstract {
    max-width: 100%;
  }
}
</style>
