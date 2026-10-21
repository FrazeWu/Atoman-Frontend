<template>
  <div class="mobile-blog-discover">
    <!-- Header & Search -->
    <header class="mobile-blog-discover__header">
      <div class="mobile-blog-discover__search">
        <MInput
          v-model="searchQuery"
          placeholder="搜索长文、短笺、专栏..."
          clearable
          data-testid="blog-search-input"
        />
      </div>
    </header>

    <main class="mobile-blog-discover__content">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="mobile-blog-discover__loading">
        <div class="blog-hero-skeleton" />
        <div v-for="n in 3" :key="n" class="blog-item-skeleton" />
      </div>

      <template v-else>
        <!-- Hero Featured Card (Only show if not searching or if search matches hero) -->
        <section
          v-if="featuredPost && (!searchQuery || matchesSearch(featuredPost))"
          class="mobile-blog-discover__hero"
        >
          <article class="blog-hero-card" data-testid="blog-hero-card">
            <div class="blog-hero-card__badge-row">
              <span class="blog-hero-badge">今日精选</span>
              <span v-if="featuredPost.reading_time_minutes" class="blog-hero-reading-time">
                {{ featuredPost.reading_time_minutes }} 分钟阅读
              </span>
            </div>

            <h2 class="blog-hero-card__title">{{ featuredPost.title }}</h2>
            <p v-if="featuredPost.excerpt" class="blog-hero-card__excerpt">
              {{ featuredPost.excerpt }}
            </p>

            <div class="blog-hero-card__footer">
              <div class="blog-hero-author">
                <MAvatar
                  :src="featuredPost.author?.avatar"
                  :name="featuredPost.author?.name || '作者'"
                  :size="24"
                />
                <span class="blog-hero-author__name">{{ featuredPost.author?.name || '匿名' }}</span>
              </div>

              <MButton
                size="sm"
                variant="primary"
                data-testid="hero-read-btn"
                @click="openPost(featuredPost.id)"
              >
                立即阅读
              </MButton>
            </div>
          </article>
        </section>

        <!-- Trending Channels (Only show when not searching) -->
        <section v-if="!searchQuery" class="mobile-blog-discover__channels">
          <div class="mobile-blog-discover__section-header">
            <h3 class="section-title">精选专栏</h3>
          </div>
          <div class="channels-scroll-row">
            <div
              v-for="ch in channels"
              :key="ch.id"
              class="channel-mini-card"
              @click="filterByTag(ch.tag)"
            >
              <span class="channel-mini-card__tag">#{{ ch.name }}</span>
              <span class="channel-mini-card__desc">{{ ch.desc }}</span>
            </div>
          </div>
        </section>

        <!-- Articles Stream -->
        <section class="mobile-blog-discover__stream">
          <div class="mobile-blog-discover__section-header">
            <h3 class="section-title">
              {{ searchQuery ? `搜索结果 (${filteredPosts.length})` : '最新推荐' }}
            </h3>
          </div>

          <div v-if="filteredPosts.length === 0" class="blog-empty-state">
            <p class="blog-empty-state__title">未找到相关内容</p>
            <p class="blog-empty-state__desc">换个关键词试试，或浏览精选专栏。</p>
          </div>

          <div v-else class="blog-articles-list">
            <article
              v-for="post in streamPosts"
              :key="post.id"
              class="blog-stream-card"
              @click="openPost(post.id)"
            >
              <div class="blog-stream-card__meta">
                <MAvatar
                  :src="post.author?.avatar"
                  :name="post.author?.name || '作者'"
                  :size="20"
                />
                <span class="blog-stream-card__author">{{ post.author?.name || '匿名' }}</span>
                <span class="blog-stream-card__dot">·</span>
                <span class="blog-stream-card__date">{{ formatDate(post.published_at) }}</span>
                <span v-if="post.reading_time_minutes" class="blog-stream-card__dot">·</span>
                <span v-if="post.reading_time_minutes" class="blog-stream-card__mins">{{ post.reading_time_minutes }} 分钟</span>
              </div>

              <h4 class="blog-stream-card__title">{{ post.title }}</h4>
              <p v-if="post.excerpt" class="blog-stream-card__excerpt">{{ post.excerpt }}</p>

              <div v-if="post.tags && post.tags.length > 0" class="blog-stream-card__tags">
                <span v-for="t in post.tags" :key="t" class="blog-stream-tag">#{{ t }}</span>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPostList } from '@/entities/post/api/postApi'
import MInput from '@mobile/components/ui/MInput.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'

export interface BlogPostItem {
  id: string
  title: string
  excerpt?: string
  author?: {
    name: string
    avatar?: string
  }
  reading_time_minutes?: number
  tags?: string[]
  published_at?: string
}

const props = withDefaults(
  defineProps<{
    initialPosts?: BlogPostItem[]
  }>(),
  {
    initialPosts: undefined,
  }
)

const router = useRouter()
const searchQuery = ref('')
const loading = ref(false)
const rawPosts = ref<BlogPostItem[]>(props.initialPosts ? [...props.initialPosts] : [])

const channels = [
  { id: 'c1', name: '深度思考', tag: '思考', desc: '本质洞察与认知迭代' },
  { id: 'c2', name: '技术前沿', tag: '技术', desc: '架构演进与代码工匠' },
  { id: 'c3', name: '现代随笔', tag: '随笔', desc: '观察生活与日常片段' },
  { id: 'c4', name: '设计哲学', tag: '设计', desc: '极简主义与触觉体验' },
]

const fallbackPosts: BlogPostItem[] = [
  {
    id: 'fp-1',
    title: '深度工作：如何在高干扰时代专注创造',
    excerpt: '在现代碎片化信息的冲击下，深度专注成为了极为罕见且价值巨大的核心能力。',
    author: { name: '林克', avatar: '' },
    reading_time_minutes: 8,
    tags: ['思考', '生产力'],
    published_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 'fp-2',
    title: 'TypeScript 5.8 核心特性解析',
    excerpt: '本次更新在类型检查性能与模块解析方面带来了质的飞跃。',
    author: { name: '代码工匠', avatar: '' },
    reading_time_minutes: 5,
    tags: ['技术'],
    published_at: '2026-10-21T08:00:00Z',
  },
  {
    id: 'fp-3',
    title: '纯白微圆角：关于界面秩序与呼吸感',
    excerpt: '去掉花哨的大渐变和浮夸投影，让内容本身重新成为舞台的主角。',
    author: { name: '墨客', avatar: '' },
    reading_time_minutes: 6,
    tags: ['设计'],
    published_at: '2026-10-19T14:00:00Z',
  },
]

const allPosts = computed<BlogPostItem[]>(() => {
  if (props.initialPosts) return props.initialPosts
  if (rawPosts.value.length > 0) return rawPosts.value
  return fallbackPosts
})

const featuredPost = computed<BlogPostItem | null>(() => {
  return allPosts.value[0] || null
})

function matchesSearch(post: BlogPostItem): boolean {
  if (!searchQuery.value.trim()) return true
  const q = searchQuery.value.trim().toLowerCase()
  const titleMatch = post.title.toLowerCase().includes(q)
  const excerptMatch = Boolean(post.excerpt?.toLowerCase().includes(q))
  const authorMatch = Boolean(post.author?.name?.toLowerCase().includes(q))
  const tagMatch = Boolean(post.tags?.some((t) => t.toLowerCase().includes(q)))
  return titleMatch || excerptMatch || authorMatch || tagMatch
}

const filteredPosts = computed<BlogPostItem[]>(() => {
  if (!searchQuery.value.trim()) return allPosts.value
  return allPosts.value.filter(matchesSearch)
})

// Stream posts excludes hero if hero is shown
const streamPosts = computed<BlogPostItem[]>(() => {
  if (searchQuery.value.trim()) return filteredPosts.value
  return filteredPosts.value.slice(1)
})

function openPost(id: string) {
  if (router) {
    void router.push(`/post/${id}`)
  }
}

function filterByTag(tag: string) {
  searchQuery.value = tag
}

function formatDate(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return ''
  }
}

async function loadData() {
  if (props.initialPosts) return
  loading.value = true
  try {
    const res = await fetchPostList({ limit: 20 })
    if (res?.posts && res.posts.length > 0) {
      rawPosts.value = res.posts.map((p) => {
        const words = (p.content || '').length
        const mins = Math.max(1, Math.round(words / 400))
        return {
          id: String(p.id),
          title: p.title,
          excerpt: p.summary || '',
          author: {
            name: p.author?.nickname || p.author?.username || p.user?.display_name || p.user?.username || '作者',
            avatar: p.author?.avatar || p.user?.avatar_url || '',
          },
          reading_time_minutes: mins,
          tags: p.tags || [],
          published_at: p.published_at || p.created_at,
        }
      })
    }
  } catch {
    // Keep fallback
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.initialPosts) {
    void loadData()
  }
})
</script>

<style scoped>
.mobile-blog-discover {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  padding-bottom: 32px;
}

.mobile-blog-discover__header {
  padding: 12px 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
}

.mobile-blog-discover__content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Hero Featured Card */
.blog-hero-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-hero-card__badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.blog-hero-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--a-color-primary, #10b981);
  background: color-mix(in srgb, var(--a-color-primary, #10b981) 10%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--a-color-primary, #10b981) 25%, transparent);
  border-radius: var(--a-radius-control, 4px);
  padding: 2px 6px;
}

.blog-hero-reading-time {
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
}

.blog-hero-card__title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.blog-hero-card__excerpt {
  font-size: 13px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #52525b);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-hero-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}

.blog-hero-author {
  display: flex;
  align-items: center;
  gap: 8px;
}

.blog-hero-author__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text, #27272a);
}

/* Channels Scroll Row */
.mobile-blog-discover__channels {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.channels-scroll-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.channels-scroll-row::-webkit-scrollbar {
  display: none;
}

.channel-mini-card {
  flex-shrink: 0;
  width: 140px;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.channel-mini-card:active {
  background: var(--a-color-surface-hover, #fafafa);
}

.channel-mini-card__tag {
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.channel-mini-card__desc {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Articles List */
.mobile-blog-discover__stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-articles-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-stream-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.blog-stream-card:active {
  background: var(--a-color-surface-hover, #fafafa);
}

.blog-stream-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
}

.blog-stream-card__author {
  font-weight: 500;
  color: var(--a-color-text, #27272a);
}

.blog-stream-card__dot {
  color: var(--a-color-border, #d4d4d8);
}

.blog-stream-card__title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.blog-stream-card__excerpt {
  font-size: 13px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #52525b);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-stream-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.blog-stream-tag {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
  background: var(--a-color-surface-hover, #f4f4f5);
  border-radius: var(--a-radius-control, 4px);
  padding: 2px 6px;
}

/* Empty State */
.blog-empty-state {
  text-align: center;
  padding: 32px 16px;
}
.blog-empty-state__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--a-color-text, #18181b);
  margin: 0 0 6px;
}
.blog-empty-state__desc {
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
  margin: 0;
}

/* Skeletons */
.blog-hero-skeleton {
  height: 160px;
  background: var(--a-color-surface-hover, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
}
.blog-item-skeleton {
  height: 100px;
  background: var(--a-color-surface-hover, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
}
</style>
