<template>
  <div class="blog-list-view">
    <!-- Filter Chips (4px radius, strictly no 999px pills) -->
    <div class="blog-filters" role="tablist">
      <button
        type="button"
        class="blog-filter-chip"
        :class="{ 'is-active': selectedTag === '' }"
        data-testid="blog-filter-chip"
        role="tab"
        :aria-selected="selectedTag === ''"
        @click="selectTag('')"
      >
        全部
      </button>
      <button
        v-for="tag in availableTags"
        :key="tag"
        type="button"
        class="blog-filter-chip"
        :class="{ 'is-active': selectedTag === tag }"
        data-testid="blog-filter-chip"
        role="tab"
        :aria-selected="selectedTag === tag"
        @click="selectTag(tag)"
      >
        {{ tag }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="blog-list-loading">
      <div v-for="n in 3" :key="n" class="blog-card-skeleton" />
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredPosts.length === 0" class="blog-list-empty">
      <p class="blog-list-empty__title">暂无相关博客文章</p>
      <p class="blog-list-empty__desc">切换标签或稍后再来查看。</p>
    </div>

    <!-- Posts Stream -->
    <div v-else class="blog-posts-stream">
      <article
        v-for="post in filteredPosts"
        :key="post.id"
        class="blog-post-card"
        data-testid="blog-post-card"
        @click="openPost(post)"
      >
        <div class="blog-post-card__header">
          <MAvatar
            :src="post.author?.avatar"
            :name="post.author?.name || 'Author'"
            :size="24"
            class="blog-post-card__avatar"
          />
          <span class="blog-post-card__author">{{ post.author?.name || '匿名' }}</span>
          <span class="blog-post-card__dot">·</span>
          <span class="blog-post-card__date">{{ formatDate(post.published_at) }}</span>
          <span v-if="post.reading_time_minutes" class="blog-post-card__dot">·</span>
          <span v-if="post.reading_time_minutes" class="blog-post-card__reading-time">{{ post.reading_time_minutes }} 分钟</span>
        </div>

        <h2 class="blog-post-card__title">{{ post.title }}</h2>
        <p v-if="post.excerpt" class="blog-post-card__excerpt">{{ post.excerpt }}</p>

        <div v-if="post.tags && post.tags.length > 0" class="blog-post-card__tags">
          <span
            v-for="tag in post.tags"
            :key="tag"
            class="blog-post-card__tag"
          >
            #{{ tag }}
          </span>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import { fetchPostList } from '@/entities/post/api/postApi'

export interface BlogPostItem {
  id: string
  title: string
  excerpt?: string
  author?: {
    name: string
    avatar?: string
  }
  published_at?: string
  tags?: string[]
  reading_time_minutes?: number
}

const props = withDefaults(
  defineProps<{
    initialPosts?: BlogPostItem[]
  }>(),
  {
    initialPosts: undefined,
  }
)

const emit = defineEmits<{
  (e: 'select', post: BlogPostItem): void
}>()

const router = useRouter()

const selectedTag = ref('')
const loading = ref(false)
const postsList = ref<BlogPostItem[]>(props.initialPosts ? [...props.initialPosts] : [])

const posts = computed(() => {
  if (props.initialPosts) return props.initialPosts
  return postsList.value
})

const availableTags = computed(() => {
  const set = new Set<string>()
  for (const post of posts.value) {
    if (post.tags) {
      for (const t of post.tags) {
        set.add(t)
      }
    }
  }
  return Array.from(set)
})

const filteredPosts = computed(() => {
  if (!selectedTag.value) return posts.value
  return posts.value.filter((p) => p.tags?.includes(selectedTag.value))
})

watch(() => props.initialPosts, (next) => {
  if (next) {
    postsList.value = [...next]
  }
})

function selectTag(tag: string) {
  selectedTag.value = tag
}

function openPost(post: BlogPostItem) {
  emit('select', post)
  void router.push(`/post/${post.id}`)
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

async function loadPosts() {
  if (props.initialPosts) return
  loading.value = true
  try {
    const res = await fetchPostList({ limit: 20 })
    if (res?.posts) {
      postsList.value = res.posts.map((p) => {
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
          published_at: p.published_at || p.created_at,
          tags: p.tags || [],
          reading_time_minutes: mins,
        }
      })
    }
  } catch {
    // Graceful fallback
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.initialPosts) {
    void loadPosts()
  }
})
</script>

<style scoped>
.blog-list-view {
  min-height: 100vh;
  background-color: #ffffff;
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}

.blog-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  background-color: #ffffff;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f5f9);
  position: sticky;
  top: 0;
  z-index: 10;
}

.blog-filters::-webkit-scrollbar {
  display: none;
}

.blog-filter-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-muted, #64748b);
  background-color: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  user-select: none;
}

.blog-filter-chip.is-active {
  background-color: var(--a-color-text, #0f172a);
  color: #ffffff;
  border-color: var(--a-color-text, #0f172a);
}

.blog-posts-stream {
  display: flex;
  flex-direction: column;
}

.blog-post-card {
  padding: 16px;
  border-bottom: 1px solid var(--a-color-border-soft, #f1f5f9);
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.blog-post-card:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.blog-post-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--a-color-muted, #64748b);
  margin-bottom: 8px;
}

.blog-post-card__avatar {
  border-radius: 4px;
}

.blog-post-card__author {
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
}

.blog-post-card__dot {
  color: var(--a-color-muted, #94a3b8);
}

.blog-post-card__reading-time {
  color: var(--a-color-muted, #94a3b8);
}

.blog-post-card__title {
  font-size: 16.5px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--a-color-text, #0f172a);
  margin: 0 0 6px 0;
  letter-spacing: -0.01em;
}

.blog-post-card__excerpt {
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #475569);
  margin: 0 0 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-post-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.blog-post-card__tag {
  font-size: 11.5px;
  color: var(--a-color-muted, #64748b);
  background-color: var(--a-color-surface-muted, #f1f5f9);
  padding: 2px 6px;
  border-radius: var(--a-radius-control, 4px);
}

.blog-list-empty,
.blog-list-loading {
  padding: 48px 16px;
  text-align: center;
}

.blog-list-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin-bottom: 6px;
}

.blog-list-empty__desc {
  font-size: 13px;
  color: var(--a-color-muted, #64748b);
  margin: 0;
}

.blog-card-skeleton {
  height: 90px;
  margin: 12px 16px;
  background-color: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #f1f5f9);
  border-radius: 4px;
}
</style>
