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
      <RouterLink :to="modulePathUrl('blog', '/')" class="a-link">← 返回文章</RouterLink>
    </div>

    <!-- Draft (only visible to owner) -->
    <div v-else-if="errorStatus === 403" class="a-page-md" style="padding-top:6rem;text-align:center">
      <p style="font-size:3rem;font-weight:900;color:var(--a-color-disabled-border);margin-bottom:1rem">草稿</p>
      <p class="a-muted" style="margin-bottom:1.5rem">该文章尚未发布，请登录后查看或编辑</p>
      <RouterLink :to="modulePathUrl('blog', `/post/${postId}/edit`)" class="a-link">去编辑 →</RouterLink>
    </div>

    <article v-else-if="post" class="post-reading-page">
      <!-- Cover image -->
      <div v-if="post.cover_url" style="width:100%;max-height:20rem;overflow:hidden">
        <img :src="post.cover_url" :alt="post.title" style="width:100%;object-fit:cover;max-height:20rem" />
      </div>

      <div class="reading-mobile-tools">
        <button data-test="mobile-collection" type="button" class="reading-icon-button" title="合集" @click="mobilePanel = 'collection'">
          <Library :size="17" /><span>合集</span>
        </button>
        <button v-if="outline.length >= 3" data-test="mobile-toc" type="button" class="reading-icon-button" title="目录" @click="mobilePanel = 'toc'">
          <List :size="17" /><span>目录</span>
        </button>
      </div>

      <div class="reading-layout">
        <aside data-test="collection-rail" class="reading-rail reading-collection-rail">
          <CollectionNavigation
            :post="post"
            :posts="collectionPosts"
            :previous-post="previousPost"
            :next-post="nextPost"
          />
        </aside>

        <main class="reading-main">
          <RouterLink :to="modulePathUrl('blog', '/')" class="a-link">← 文章</RouterLink>

        <!-- Title -->
        <h1 
          :class="isAcademic ? 'academic-title' : 'a-title'" 
          :style="!isAcademic ? 'margin-top:1.5rem;margin-bottom:1rem' : ''"
        >
          {{ post.title }}
        </h1>

        <div class="normal-meta">
          <a :href="userUrl(post.user?.username || '')" class="reading-author">
            <span class="reading-avatar">{{ (post.user?.display_name || post.user?.username || '?').charAt(0).toUpperCase() }}</span>
            <strong>{{ post.user?.display_name || post.user?.username }}</strong>
          </a>
          <span class="a-label a-muted">发布于 {{ formatDate(post.published_at || post.created_at) }}</span>
          <span class="a-label a-muted">更新于 {{ formatDate(post.updated_at) }}</span>
          <RouterLink v-if="isOwner" :to="modulePathUrl('blog', `/post/${post.id}/edit`)" class="a-btn a-btn--sm a-btn--primary">编辑</RouterLink>
        </div>

        <div class="reading-stats" aria-label="文章统计">
          <span><Eye :size="15" />{{ post.view_count || 0 }} 阅读</span>
          <span><Heart :size="15" />{{ likesCount }} 点赞</span>
          <span><MessageCircle :size="15" />{{ post.comments_count || 0 }} 评论</span>
          <span><Bookmark :size="15" />{{ post.bookmarks_count || 0 }} 收藏</span>
          <span><Users :size="15" />{{ post.channel_followers_count || 0 }} 订阅</span>
          <span>{{ wordCount }} 字</span>
        </div>

        <!-- Markdown content -->
        <div 
          class="prose-blog" 
          :class="{ 'prose-blog-academic': isAcademic }" 
          style="margin-bottom:3rem" 
          v-html="renderedContent" 
        />

        <div class="reading-actions">
          <button type="button" class="reading-action" :class="{ active: liked }" title="点赞" :disabled="likePending" @click="toggleLike"><Heart :size="17" />{{ likesCount }}</button>
          <button type="button" class="reading-action" :class="{ active: bookmarked }" title="收藏" @click="openBookmarkDialog"><Bookmark :size="17" />收藏</button>
          <button type="button" class="reading-action" :class="{ active: inReadingList }" title="稍后阅读" @click="toggleReadingList"><Clock3 :size="17" />稍后阅读</button>
          <button type="button" class="reading-action" title="复制链接" @click="copyLink"><Share2 :size="17" />分享</button>
        </div>

        <!-- Comments -->
        <CommentSection
          :target="{ kind: 'blog_post', resourceId: post.id }"
        />
        </main>

        <aside v-if="outline.length >= 3" data-test="toc-rail" class="reading-rail reading-toc-rail">
          <TableOfContents :items="outline" />
        </aside>
      </div>
    </article>

    <PSheet :show="mobilePanel === 'collection'" side="bottom" title="合集" close-type="header" @close="mobilePanel = null">
      <CollectionNavigation v-if="post" :post="post" :posts="collectionPosts" :previous-post="previousPost" :next-post="nextPost" />
    </PSheet>
    <PSheet :show="mobilePanel === 'toc'" side="bottom" title="目录" close-type="header" @close="mobilePanel = null">
      <TableOfContents :items="outline" />
    </PSheet>
    <PToast v-model="toastVisible" :message="toastMessage" />
    <BookmarkFolderModal ref="bookmarkModalRef" @changed="onBookmarkChanged" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CommentSection from '@/components/comment/CommentSection.vue'
import CollectionNavigation from '@/components/blog/CollectionNavigation.vue'
import TableOfContents from '@/components/blog/TableOfContents.vue'
import BookmarkFolderModal from '@/components/blog/BookmarkFolderModal.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PToast from '@/components/ui/PToast.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { modulePathUrl, userUrl } from '@/composables/useSubdomainNav'
import { useApi } from '@/composables/useApi'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import type { Post } from '@/types'
import { useSheetStore } from '@/stores/sheet'
import { Bookmark, Clock3, Eye, Heart, Library, List, MessageCircle, Share2, Users } from 'lucide-vue-next'

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
const feedStore = useFeedStore()
const api = useApi()
const { renderMarkdown } = useMarkdownRenderer()

const post = ref<Post | null>(null)
const collectionPosts = ref<Post[]>([])
const mobilePanel = ref<'collection' | 'toc' | null>(null)
const isAcademic = ref(false)
const loading = ref(true)
const errorStatus = ref<number | null>(null)
const liked = ref(false)
const likesCount = ref(0)
const likePending = ref(false)
let likeRequestToken = 0
const bookmarked = ref(false)
const currentBookmarkId = ref('')
const bookmarkModalRef = ref<InstanceType<typeof BookmarkFolderModal> | null>(null)
const toastVisible = ref(false)
const toastMessage = ref('')
const postEmbeds = ref<Record<string, EmbedData>>({})
const musicEmbeds = ref<Record<string, EmbedData>>({})
const videoEmbeds = ref<Record<string, EmbedData>>({})

const isOwner = computed(() => authStore.user?.uuid === post.value?.user_id)
const inReadingList = computed(() => !!post.value && feedStore.readingListItemIds.has(post.value.id))
const wordCount = computed(() => (post.value?.content || '').replace(/```[\s\S]*?```/g, '').replace(/[#*`>~_\[\]()]/g, '').replace(/\s+/g, '').length)

const outline = computed(() => {
  const items: Array<{ id: string; text: string; level: number }> = []
  const matches = (post.value?.content || '').matchAll(/^(#{2,6})\s+(.+)$/gm)
  for (const match of matches) {
    const text = match[2].replace(/[*_`~\[\]]/g, '').trim()
    const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')
    if (text && id) items.push({ id, text, level: match[1].length })
  }
  return items
})

const currentCollectionIndex = computed(() => collectionPosts.value.findIndex(item => item.id === post.value?.id))
const previousPost = computed(() => currentCollectionIndex.value > 0 ? collectionPosts.value[currentCollectionIndex.value - 1] || null : null)
const nextPost = computed(() => currentCollectionIndex.value >= 0 && currentCollectionIndex.value < collectionPosts.value.length - 1
  ? collectionPosts.value[currentCollectionIndex.value + 1] || null
  : null)

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
  likeRequestToken += 1
  likePending.value = false
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
      liked.value = Boolean(post.value?.liked)

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
        await Promise.all([fetchEmbeds(post.value.content), fetchCollectionPosts(post.value.collection_id)])
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
      const bookmark = items.find((b: { post_id: string }) => b.post_id === postId)
      bookmarked.value = Boolean(bookmark)
      currentBookmarkId.value = bookmark?.id || ''
    }
  } catch (e) { console.error(e) }
}

const fetchCollectionPosts = async (collectionId?: string) => {
  if (!collectionId) {
    collectionPosts.value = []
    return
  }
  try {
    const res = await fetch(`${api.blog.posts}?collection_id=${collectionId}&page_size=100`, { headers: authHeaders() })
    if (!res.ok) return
    const payload = await res.json()
    collectionPosts.value = ((payload.data || []) as Post[]).sort((left, right) =>
      (left.collection_position || 0) - (right.collection_position || 0))
  } catch (e) {
    console.error(e)
  }
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
            href: `/posts/post/${id}`,
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
            href: `/music/album/${id}`,
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

  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(api.videos.get(id), { headers: authHeaders() })
        if (!res.ok) return null
        const payload = await res.json()
        const video = (payload.data || payload) as import('@/types').Video
        return [
          id,
          {
            id,
            title: video.title,
            summary: video.description,
            meta: video.channel?.name,
            href: `/videos/watch/${id}`,
          } satisfies EmbedData,
        ] as const
      } catch {
        return null
      }
    }),
  )

  videoEmbeds.value = Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
}

const fetchEmbeds = async (content: string) => {
  await Promise.all([fetchPostEmbeds(content), fetchMusicEmbeds(content), fetchVideoEmbeds(content)])
}

const toggleLike = async () => {
  if (!authStore.isAuthenticated || !post.value || likePending.value) return
  const targetPostId = post.value.id
  const method = liked.value ? 'DELETE' : 'POST'
  const requestToken = ++likeRequestToken
  likePending.value = true
  try {
    const res = await fetch(api.blog.likes, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({ target_type: 'post', target_id: targetPostId })
    })
    if (res.ok) {
      if (requestToken !== likeRequestToken || post.value?.id !== targetPostId) return
      liked.value = method === 'POST'
      const countRes = await fetch(api.blog.postLikesCount(targetPostId))
      if (countRes.ok) {
        const data = await countRes.json()
        if (requestToken !== likeRequestToken || post.value?.id !== targetPostId) return
        const count = data.data?.count
        if (typeof count === 'number') likesCount.value = count
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    if (requestToken === likeRequestToken) likePending.value = false
  }
}

const openBookmarkDialog = () => {
  if (!authStore.isAuthenticated) {
    toastMessage.value = '请先登录'
    toastVisible.value = true
    return
  }
  if (post.value) void bookmarkModalRef.value?.open(post.value.id)
}

const onBookmarkChanged = ({ saved }: { postId: string; saved: boolean }) => {
  if (!post.value) return
  bookmarked.value = saved
  post.value.bookmarks_count = Math.max(0, (post.value.bookmarks_count || 0) + (saved ? 1 : -1))
}

const toggleReadingList = async () => {
  if (!post.value) return
  if (!authStore.isAuthenticated) {
    toastMessage.value = '请先登录'
    toastVisible.value = true
    return
  }
  await feedStore.toggleReadingListItem(post.value.id, 'post')
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toastMessage.value = '链接已复制'
  } catch {
    toastMessage.value = '复制失败'
  }
  toastVisible.value = true
}

onMounted(fetchPost)
onBeforeUnmount(() => {
  likeRequestToken += 1
  likePending.value = false
})
</script>

<style scoped>
.post-reading-page { padding-bottom: 5rem; }
.reading-layout {
  display: grid;
  grid-template-columns: minmax(150px, 220px) minmax(0, 760px) minmax(150px, 210px);
  justify-content: center;
  gap: 2rem;
  width: min(100% - 2rem, 1320px);
  margin: 0 auto;
  padding-top: 2.5rem;
}
.reading-main { min-width: 0; }
.reading-rail { position: sticky; top: 5rem; align-self: start; max-height: calc(100vh - 7rem); overflow-y: auto; padding: 0.25rem; }
.reading-mobile-tools { display: none; }
.reading-author { display: flex; align-items: center; gap: 0.5rem; color: inherit; text-decoration: none; }
.reading-avatar { width: 2rem; height: 2rem; display: grid; place-items: center; background: var(--a-color-fg); color: var(--a-color-bg); font-weight: 900; font-size: 0.75rem; }
.reading-stats { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; padding-bottom: 1.5rem; color: var(--a-color-muted); font-size: 0.78rem; }
.reading-stats span { display: inline-flex; align-items: center; gap: 0.3rem; }
.reading-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 1.25rem 0; margin-bottom: 2rem; border-top: 1px solid var(--a-color-line-soft); border-bottom: 1px solid var(--a-color-line-soft); }
.reading-action, .reading-icon-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; min-height: 2.25rem; padding: 0.4rem 0.65rem; border: 1px solid var(--a-color-line); background: var(--a-color-bg); color: var(--a-color-fg); cursor: pointer; }
.reading-action.active { background: var(--a-color-fg); color: var(--a-color-bg); }

@media (max-width: 1024px) {
  .reading-layout { display: block; width: min(100% - 2rem, 760px); }
  .reading-rail { display: none; }
  .reading-mobile-tools { display: flex; position: sticky; top: 3.5rem; z-index: 20; justify-content: center; gap: 0.5rem; padding: 0.65rem; background: var(--a-color-bg); border-bottom: 1px solid var(--a-color-line-soft); }
}

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
