<template>
  <div class="blog-me-view">
    <!-- Unauthenticated Guest State -->
    <div v-if="authStore && !authStore.isAuthenticated" class="blog-me-guest-wrap">
      <MGuestCard
        title="登录查看创作者中心"
        description="登录后可管理发表的短笺、长文与收藏内容。"
        redirect="/posts/me"
      />
    </div>

    <template v-else>
      <!-- Author Profile Card -->
      <section class="blog-me-profile" data-testid="author-profile-card">
      <div class="blog-me-profile__top">
        <MAvatar
          :src="profile.avatar"
          :name="profile.name || profile.username || '作者'"
          :size="56"
        />
        <div class="blog-me-profile__identity">
          <h1 class="blog-me-profile__name">{{ profile.name || profile.username || '文字作者' }}</h1>
          <span class="blog-me-profile__handle">@{{ profile.username || 'author' }}</span>
        </div>
      </div>

      <p v-if="profile.bio" class="blog-me-profile__bio">{{ profile.bio }}</p>

      <!-- 4-Stat Grid -->
      <div class="blog-me-stats-grid">
        <div class="stat-box">
          <span class="stat-box__val">{{ profile.stats?.notes ?? userNotes.length }}</span>
          <span class="stat-box__label">短笺</span>
        </div>
        <div class="stat-box">
          <span class="stat-box__val">{{ profile.stats?.articles ?? userArticles.length }}</span>
          <span class="stat-box__label">长文</span>
        </div>
        <div class="stat-box">
          <span class="stat-box__val">{{ profile.stats?.likes ?? 0 }}</span>
          <span class="stat-box__label">获赞</span>
        </div>
        <div class="stat-box">
          <span class="stat-box__val">{{ profile.stats?.followers ?? 0 }}</span>
          <span class="stat-box__label">关注者</span>
        </div>
      </div>
    </section>

    <!-- Sub Navigation Tabs -->
    <nav class="blog-me-subtabs" role="tablist">
      <button
        type="button"
        class="subtab-btn"
        :class="{ 'is-active': activeSubTab === 'notes' }"
        data-testid="me-tab-notes"
        role="tab"
        :aria-selected="activeSubTab === 'notes'"
        @click="activeSubTab = 'notes'"
      >
        我的短笺 ({{ userNotes.length }})
      </button>

      <button
        type="button"
        class="subtab-btn"
        :class="{ 'is-active': activeSubTab === 'articles' }"
        data-testid="me-tab-articles"
        role="tab"
        :aria-selected="activeSubTab === 'articles'"
        @click="activeSubTab = 'articles'"
      >
        我的长文 ({{ userArticles.length }})
      </button>

      <button
        type="button"
        class="subtab-btn"
        :class="{ 'is-active': activeSubTab === 'bookmarks' }"
        data-testid="me-tab-bookmarks"
        role="tab"
        :aria-selected="activeSubTab === 'bookmarks'"
        @click="activeSubTab = 'bookmarks'"
      >
        我的收藏
      </button>
    </nav>

    <!-- Tab Panels -->
    <main class="blog-me-content">
      <!-- Panel 1: Notes -->
      <div v-if="activeSubTab === 'notes'" class="me-panel me-panel--notes">
        <div v-if="userNotes.length === 0" class="me-empty-state">
          <p class="me-empty-state__title">暂无已发布的短笺</p>
          <p class="me-empty-state__desc">随手记录灵感，即刻发布分享。</p>
          <router-link to="/posts/notes">
            <MButton variant="secondary" size="sm">前往短笺流</MButton>
          </router-link>
        </div>

        <div v-else class="me-items-list">
          <article
            v-for="note in userNotes"
            :key="note.id"
            class="me-note-card"
          >
            <p class="me-note-card__text">{{ note.content }}</p>
            <div class="me-note-card__footer">
              <span class="me-meta-time">{{ formatTime(note.created_at) }}</span>
              <div class="me-meta-actions">
                <span class="me-meta-likes">
                  <MIcon name="heart" size="xs" />
                  {{ note.likes_count ?? 0 }}
                </span>
                <button
                  type="button"
                  class="me-delete-btn"
                  aria-label="删除"
                  @click="deleteUserNote(note.id)"
                >
                  <MIcon name="xmark" size="xs" />
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- Panel 2: Articles -->
      <div v-else-if="activeSubTab === 'articles'" class="me-panel me-panel--articles">
        <div v-if="userArticles.length === 0" class="me-empty-state">
          <p class="me-empty-state__title">暂无已发表的长文</p>
          <p class="me-empty-state__desc">开始撰写你的第一篇深度文章吧。</p>
          <router-link to="/studio">
            <MButton variant="secondary" size="sm">前往创作中心</MButton>
          </router-link>
        </div>

        <div v-else class="me-items-list">
          <article
            v-for="art in userArticles"
            :key="art.id"
            class="me-article-card"
            @click="openArticle(art.id)"
          >
            <h3 class="me-article-card__title">{{ art.title }}</h3>
            <div class="me-article-card__meta">
              <span v-if="art.reading_time_minutes">{{ art.reading_time_minutes }} 分钟阅读</span>
              <span v-if="art.reading_time_minutes">·</span>
              <span>{{ formatTime(art.published_at) }}</span>
            </div>
          </article>
        </div>
      </div>

      <!-- Panel 3: Bookmarks -->
      <div v-else class="me-panel me-panel--bookmarks">
        <div v-if="userBookmarks.length === 0" class="me-empty-state" data-testid="bookmarks-empty">
          <MIcon name="bookmark" size="lg" custom-class="empty-icon" />
          <p class="me-empty-state__title">暂无收藏内容</p>
          <p class="me-empty-state__desc">在阅读长文或短笺时，点击书签图标即可收藏。</p>
          <router-link to="/posts">
            <MButton variant="secondary" size="sm">去发现文章</MButton>
          </router-link>
        </div>

        <div v-else class="me-items-list" data-testid="bookmarks-list">
          <article
            v-for="bm in userBookmarks"
            :key="bm.id"
            class="me-article-card"
            @click="openArticle(bm.content_id)"
          >
            <h3 class="me-article-card__title">{{ bm.title }}</h3>
            <p v-if="bm.summary" class="me-article-card__excerpt">{{ bm.summary }}</p>
            <div class="me-article-card__meta">
              <span v-if="bm.reading_time_minutes">{{ bm.reading_time_minutes }} 分钟阅读</span>
              <span v-if="bm.reading_time_minutes">·</span>
              <span>{{ formatTime(bm.published_at) }}</span>
            </div>
          </article>
        </div>
      </div>
    </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { apiRequestEnvelope } from '@/api/client'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'

export interface AuthorProfile {
  name: string
  username: string
  avatar?: string
  bio?: string
  stats?: {
    notes?: number
    articles?: number
    likes?: number
    followers?: number
  }
}

export interface UserNoteItem {
  id: string
  content: string
  created_at?: string
  likes_count?: number
  comments_count?: number
}

export interface UserArticleItem {
  id: string
  title: string
  reading_time_minutes?: number
  published_at?: string
}

export interface UserBookmarkItem {
  id: string
  content_id: string
  title: string
  summary?: string
  reading_time_minutes?: number
  published_at?: string
}

const props = withDefaults(
  defineProps<{
    initialProfile?: AuthorProfile
    initialNotes?: UserNoteItem[]
    initialArticles?: UserArticleItem[]
    initialBookmarks?: UserBookmarkItem[]
    initialTab?: 'notes' | 'articles' | 'bookmarks'
  }>(),
  {
    initialProfile: undefined,
    initialNotes: undefined,
    initialArticles: undefined,
    initialBookmarks: undefined,
    initialTab: 'notes',
  }
)

const router = useRouter()
const api = useApi()
const authStore = getActivePinia() ? useAuthStore() : null

const activeSubTab = ref<'notes' | 'articles' | 'bookmarks'>(props.initialTab)

const profile = ref<AuthorProfile>(
  props.initialProfile || {
    name: authStore?.user?.display_name || authStore?.user?.username || '文字作者',
    username: authStore?.user?.username || 'writer',
    avatar: authStore?.user?.avatar_url || '',
    bio: authStore?.user?.bio || '保持书写，持续记录与思考。',
    stats: {
      notes: 0,
      articles: 0,
      likes: 0,
      followers: 0,
    },
  }
)

const userNotes = ref<UserNoteItem[]>(
  props.initialNotes ? [...props.initialNotes] : []
)

const userArticles = ref<UserArticleItem[]>(
  props.initialArticles ? [...props.initialArticles] : []
)

const userBookmarks = ref<UserBookmarkItem[]>(
  props.initialBookmarks ? [...props.initialBookmarks] : []
)

async function deleteUserNote(id: string) {
  const prevNotes = [...userNotes.value]
  userNotes.value = userNotes.value.filter((n) => n.id !== id)
  if (profile.value.stats) {
    profile.value.stats.notes = userNotes.value.length
  }
  try {
    await apiRequestEnvelope(api.blog.shortNote(id), {
      method: 'DELETE',
    })
  } catch {
    userNotes.value = prevNotes
    if (profile.value.stats) {
      profile.value.stats.notes = userNotes.value.length
    }
  }
}

function openArticle(id: string) {
  if (router) {
    void router.push(`/post/${id}`)
  }
}

function formatTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return ''
  }
}

async function loadAuthorData() {
  if (!authStore?.isAuthenticated || !authStore.user) return

  const user = authStore.user
  if (!props.initialProfile) {
    profile.value.name = user.display_name || user.username || '文字作者'
    profile.value.username = user.username || 'writer'
    profile.value.avatar = user.avatar_url || ''
    if (user.bio) {
      profile.value.bio = user.bio
    }
  }

  const authorId = user.uuid || user.id
  if (!authorId) return

  try {
    if (!props.initialNotes) {
      const notesRes = await apiRequestEnvelope<any[]>(`${api.blog.shortNotes}?user_id=${encodeURIComponent(String(authorId))}&page=1&page_size=30`)
      if (notesRes?.data && Array.isArray(notesRes.data)) {
        userNotes.value = notesRes.data.map((n) => ({
          id: String(n.id),
          content: n.content || '',
          created_at: n.created_at,
          likes_count: n.likes_count || 0,
          comments_count: n.comments_count || 0,
        }))
        if (profile.value.stats) {
          profile.value.stats.notes = userNotes.value.length
        }
      }
    }

    if (!props.initialArticles) {
      const articlesRes = await apiRequestEnvelope<any[]>(`${api.blog.posts}?author_id=${encodeURIComponent(String(authorId))}&page=1&limit=30`)
      if (articlesRes?.data && Array.isArray(articlesRes.data)) {
        userArticles.value = articlesRes.data.map((a) => {
          const words = (a.content || '').length
          return {
            id: String(a.id),
            title: a.title,
            reading_time_minutes: Math.max(1, Math.round(words / 400)),
            published_at: a.published_at || a.created_at,
          }
        })
        if (profile.value.stats) {
          profile.value.stats.articles = userArticles.value.length
        }
      }
    }

    if (!props.initialBookmarks) {
      const bookmarksRes = await apiRequestEnvelope<any[]>(api.blog.bookmarks)
      if (bookmarksRes?.data && Array.isArray(bookmarksRes.data)) {
        userBookmarks.value = bookmarksRes.data.map((b: any) => {
          const content = b.content || {}
          const words = (content.content || '').length
          return {
            id: String(b.id),
            content_id: String(b.content_id || content.id),
            title: content.title || '收藏文章',
            summary: content.summary || '',
            reading_time_minutes: Math.max(1, Math.round(words / 400)),
            published_at: b.created_at || content.published_at,
          }
        })
      }
    }
  } catch {
    // Graceful fallback
  }
}

watch(
  () => authStore?.user,
  () => {
    void loadAuthorData()
  },
  { deep: true }
)

onMounted(() => {
  void loadAuthorData()
})
</script>

<style scoped>
.blog-me-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  padding-bottom: 32px;
}

.blog-me-guest-wrap {
  padding: 16px;
}

.blog-me-profile {
  padding: 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blog-me-profile__top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.blog-me-profile__identity {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.blog-me-profile__name {
  font-size: 18px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.blog-me-profile__handle {
  font-size: 13px;
  color: var(--a-color-text-secondary, #71717a);
}

.blog-me-profile__bio {
  font-size: 13px;
  line-height: 1.5;
  color: var(--a-color-text-secondary, #52525b);
  margin: 0;
}

.blog-me-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  background: var(--a-color-surface-hover, #fbfbfb);
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  border-radius: var(--a-radius-card, 4px);
  padding: 10px 4px;
  text-align: center;
}

.stat-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-box__val {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.stat-box__label {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

/* Sub-tabs */
.blog-me-subtabs {
  display: flex;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #ebebeb);
}

.subtab-btn {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 12px 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--a-color-text-secondary, #71717a);
  cursor: pointer;
  transition: all 0.15s ease;
}

.subtab-btn.is-active {
  color: var(--a-color-text, #18181b);
  border-bottom-color: var(--a-color-text, #18181b);
  font-weight: 600;
}

/* Content */
.blog-me-content {
  padding: 16px;
}

.me-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.me-note-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.me-note-card__text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--a-color-text, #27272a);
  margin: 0;
}

.me-note-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.me-meta-time {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

.me-meta-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.me-meta-likes {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.me-delete-btn {
  background: transparent;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--a-color-text-secondary, #a1a1aa);
  display: flex;
  align-items: center;
  justify-content: center;
}

.me-article-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.me-article-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.me-article-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

/* Empty States */
.me-empty-state {
  text-align: center;
  padding: 48px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.empty-icon {
  color: var(--a-color-border, #d4d4d8);
  margin-bottom: 4px;
}

.me-empty-state__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.me-empty-state__desc {
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
  margin: 0 0 6px;
}
</style>
