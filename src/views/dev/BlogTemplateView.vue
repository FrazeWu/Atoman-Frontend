<template>
  <div class="a-module-layout" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar module="blog" />
    <main class="a-main-content">
      <div class="a-page blog-template">
        <PPageHeader title="博客范例" accent>
          <template #action>
            <PButton outline to="/posts">返回实际博客</PButton>
          </template>
        </PPageHeader>

    <!-- 分类与排序筛选栏 -->
    <div class="blog-template__filters">
      <div class="blog-template__filter-group">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="blog-template__chip"
          :class="{ 'is-active': activeCategory === cat.id }"
          @click="activeCategory = cat.id"
        >
          {{ cat.name }}
        </button>
      </div>
      <div class="blog-template__filter-group blog-template__filter-group--end">
        <PSegmentedControl
          v-model="sortBy"
          :options="sortOptions"
        />
      </div>
    </div>

    <!-- 主布局：Stream + Sticky Rail -->
    <div class="blog-template__layout">
      <!-- 左侧内容流 -->
      <main class="blog-template__stream">
        <!-- 重点推荐 Hero 文章卡片 -->
        <article class="blog-template__hero-card" @click="openPostSheet(heroPost.id, heroPost.title)">
          <div v-if="heroPost.cover" class="blog-template__hero-cover-wrapper">
            <img :src="heroPost.cover" :alt="heroPost.title" class="blog-template__hero-cover" />
            <span class="blog-template__hero-badge">置顶精选</span>
          </div>
          <div class="blog-template__hero-body">
            <div class="blog-template__hero-meta">
              <span class="blog-template__channel">《{{ heroPost.channel }}》</span>
              <span class="blog-template__dot">·</span>
              <time>{{ heroPost.time }}</time>
            </div>
            <h2 class="blog-template__hero-title">{{ heroPost.title }}</h2>
            <p class="blog-template__hero-summary">{{ heroPost.summary }}</p>
            <div class="blog-template__hero-footer">
              <div class="blog-template__author">
                <PAvatar :src="heroPost.authorAvatar" :name="heroPost.author" size="xs" />
                <span>{{ heroPost.author }}</span>
              </div>
              <InteractionBar
                :liked="heroPost.liked"
                :like-count="heroPost.likeCount"
                :comment-count="heroPost.commentCount"
                @like="heroPost.liked = true; heroPost.likeCount++"
                @unlike="heroPost.liked = false; heroPost.likeCount--"
                @comment="openPostSheet(heroPost.id, heroPost.title)"
              />
            </div>
          </div>
        </article>

        <!-- 文章列表流 -->
        <div class="blog-template__feed">
          <article
            v-for="post in posts"
            :key="post.id"
            class="blog-template__post-card"
            @click="openPostSheet(post.id, post.title)"
          >
            <div class="blog-template__post-main">
              <div class="blog-template__post-header">
                <PAvatar :src="post.authorAvatar" :name="post.author" size="xs" />
                <span class="blog-template__post-author">{{ post.author }}</span>
                <span class="blog-template__dot">·</span>
                <span class="blog-template__channel">《{{ post.channel }}》</span>
                <span class="blog-template__dot">·</span>
                <time class="blog-template__post-time">{{ post.time }}</time>
              </div>

              <h3 class="blog-template__post-title">{{ post.title }}</h3>
              <p class="blog-template__post-summary">{{ post.summary }}</p>

              <div class="blog-template__post-footer">
                <div class="blog-template__tags">
                  <span v-for="tag in post.tags" :key="tag" class="blog-template__tag">#{{ tag }}</span>
                </div>
                <InteractionBar
                  :liked="post.liked"
                  :like-count="post.likeCount"
                  :comment-count="post.commentCount"
                  @like="post.liked = true; post.likeCount++"
                  @unlike="post.liked = false; post.likeCount--"
                  @comment="openPostSheet(post.id, post.title)"
                />
              </div>
            </div>

            <div v-if="post.cover" class="blog-template__post-visual">
              <img :src="post.cover" :alt="post.title" class="blog-template__post-cover" />
            </div>
          </article>
        </div>
      </main>

      <!-- 右侧智能推荐 Rail -->
      <aside class="blog-template__rail" aria-label="博客推荐">
        <!-- 热门频道卡片 -->
        <section class="blog-template__rail-section">
          <div class="blog-template__rail-header">
            <Flame :size="16" class="blog-template__rail-icon is-hot" />
            <h2>热门专栏</h2>
          </div>
          <div class="blog-template__rail-list">
            <div
              v-for="channel in hotChannels"
              :key="channel.id"
              class="blog-template__channel-item"
            >
              <div class="blog-template__channel-info">
                <strong class="blog-template__channel-name">《{{ channel.name }}》</strong>
                <span class="blog-template__channel-desc">{{ channel.desc }}</span>
              </div>
              <span class="blog-template__channel-subscribers">{{ channel.subscribers }} 订阅</span>
            </div>
          </div>
        </section>

        <!-- 本周必读 -->
        <section class="blog-template__rail-section">
          <div class="blog-template__rail-header">
            <Sparkles :size="16" class="blog-template__rail-icon is-sparkles" />
            <h2>本周精选推荐</h2>
          </div>
          <div class="blog-template__rail-list">
            <div
              v-for="item in weeklyMustRead"
              :key="item.id"
              class="blog-template__rail-note"
              @click="openPostSheet(item.id, item.title)"
            >
              <strong class="blog-template__rail-title">{{ item.title }}</strong>
              <div class="blog-template__rail-stats">
                <span><Heart :size="12" /> {{ item.likes }}</span>
                <span><MessageSquare :size="12" /> {{ item.comments }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
    </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Flame, Heart, MessageSquare, Sparkles } from 'lucide-vue-next'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import AppSidebar from '@/components/system/AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useBlogSheets } from '@/composables/useBlogSheets'

const { sidebarCollapsed } = useSidebar()
const blogSheets = useBlogSheets()

const activeCategory = ref('all')
const categories = [
  { id: 'all', name: '全部文章' },
  { id: 'tech', name: '技术探讨' },
  { id: 'design', name: '设计随笔' },
  { id: 'culture', name: '文化与哲学' },
  { id: 'devlog', name: '开发日志' },
]

const sortBy = ref('latest')
const sortOptions = [
  { value: 'latest', label: '最新发布' },
  { value: 'popular', label: '最受欢迎' },
]

function openPostSheet(id: string, title: string) {
  blogSheets.openPost(id, title)
}

const heroPost = ref({
  id: 'hero-1',
  title: '构建高可靠与现代化前端框架的视觉与交互探索',
  summary: '探索在复杂多端前端项目中，如何通过统一设计 Token、双栏 Stream 布局与轻量级半屏抽屉架构，打造沉浸且流畅的用户体验...',
  channel: '前端设计学',
  author: 'Atoman 团队',
  authorAvatar: '',
  cover: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
  time: '2 小时前',
  liked: false,
  likeCount: 42,
  commentCount: 18,
})

const posts = ref([
  {
    id: 'post-1',
    title: '短笺模式下的卡片化交互与呼吸感设计范式',
    summary: '分析卡片边框、浅阴影以及动态多图网格排版如何在移动端与桌面端实现一致的排版体验。',
    channel: 'UI/UX 思考',
    author: 'Alex Chen',
    authorAvatar: '',
    cover: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=400&q=80',
    tags: ['UI设计', '交互规范'],
    time: '3 小时前',
    liked: true,
    likeCount: 28,
    commentCount: 9,
  },
  {
    id: 'post-2',
    title: 'Go 后端 Gin + GORM 高并发架构下的内存与协程池调优实践',
    summary: '详细记录在百万级 API 请求下，Go 语言在高并发场景中的 GC 瓶颈定位与解决方案。',
    channel: 'Go 语言实践',
    author: 'Backend Team',
    authorAvatar: '',
    cover: '',
    tags: ['Go', '后端开发'],
    time: '5 小时前',
    liked: false,
    likeCount: 65,
    commentCount: 24,
  },
  {
    id: 'post-3',
    title: 'Vue 3.5 响应式系统进阶：浅层响应与组合式 API 模式选型',
    summary: '针对大对象、流式状态与虚拟列表应用，如何合理选择 shallowRef 与 triggerRef 优化性能。',
    channel: '前端设计学',
    author: 'Vue Master',
    authorAvatar: '',
    cover: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80',
    tags: ['Vue3', 'TypeScript'],
    time: '昨天 18:30',
    liked: false,
    likeCount: 89,
    commentCount: 31,
  },
])

const hotChannels = [
  { id: 'ch-1', name: '前端设计学', desc: '探索极简与沉浸式 UI 体系', subscribers: 1280 },
  { id: 'ch-2', name: 'Go 语言实践', desc: '高性能后端与微服务架构', subscribers: 960 },
  { id: 'ch-3', name: 'UI/UX 思考', desc: '用户感知与产品交互设计', subscribers: 840 },
]

const weeklyMustRead = [
  { id: 'mr-1', title: '短笺模式下的卡片化交互与呼吸感设计范式', likes: 128, comments: 45 },
  { id: 'mr-2', title: 'Vue 3.5 响应式系统进阶：浅层响应与性能优化', likes: 98, comments: 32 },
  { id: 'mr-3', title: 'Cloudflare Pages 与 Serverless 边缘架构实践', likes: 76, comments: 19 },
]
</script>

<style scoped>
.blog-template {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

/* 筛选栏 */
.blog-template__filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.blog-template__filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.blog-template__chip {
  padding: 0.4rem 0.85rem;
  font-size: 0.85rem;
  color: var(--a-color-text-secondary);
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-pill);
  cursor: pointer;
  transition: all 0.15s ease;
}

.blog-template__chip:hover {
  color: var(--a-color-text);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.blog-template__chip.is-active {
  color: var(--a-color-bg);
  background: var(--a-color-text);
  border-color: var(--a-color-text);
}

/* 主布局 */
.blog-template__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 2rem;
  align-items: start;
}

.blog-template__stream {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Hero 卡片 */
.blog-template__hero-card {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.blog-template__hero-card:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-md);
}

.blog-template__hero-cover-wrapper {
  position: relative;
  height: 100%;
  min-height: 14rem;
}

.blog-template__hero-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.blog-template__hero-badge {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  border-radius: var(--a-radius-control);
}

.blog-template__hero-body {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
}

.blog-template__hero-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--a-color-text-secondary);
  margin-bottom: 0.5rem;
}

.blog-template__hero-title {
  margin: 0 0 0.65rem;
  font-size: 1.15rem;
  font-weight: 650;
  line-height: 1.4;
  color: var(--a-color-fg);
}

.blog-template__hero-summary {
  margin: 0 0 1.25rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--a-color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-template__hero-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.blog-template__author {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--a-color-text);
  font-weight: 500;
}

/* 普通文章卡片 */
.blog-template__feed {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.blog-template__post-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7.5rem;
  gap: 1.25rem;
  padding: 1.25rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.blog-template__post-card:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.blog-template__post-header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--a-color-text-secondary);
  margin-bottom: 0.45rem;
}

.blog-template__post-author {
  font-weight: 500;
  color: var(--a-color-text);
}

.blog-template__channel {
  color: var(--a-color-primary);
  font-weight: 500;
}

.blog-template__dot {
  color: var(--a-color-muted-soft);
}

.blog-template__post-title {
  margin: 0 0 0.45rem;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.45;
  color: var(--a-color-fg);
}

.blog-template__post-summary {
  margin: 0 0 0.85rem;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--a-color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-template__post-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.blog-template__tags {
  display: flex;
  gap: 0.4rem;
}

.blog-template__tag {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.blog-template__post-visual {
  width: 7.5rem;
  height: 7.5rem;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
}

.blog-template__post-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.blog-template__post-card:hover .blog-template__post-cover {
  transform: scale(1.04);
}

/* 侧轨 */
.blog-template__rail {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.blog-template__rail-section {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
}

.blog-template__rail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.blog-template__rail-header h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.blog-template__rail-icon.is-hot {
  color: var(--a-color-warning);
}

.blog-template__rail-icon.is-sparkles {
  color: var(--a-color-primary);
}

.blog-template__rail-list {
  display: flex;
  flex-direction: column;
}

.blog-template__channel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  transition: background 0.15s ease;
}

.blog-template__channel-item:last-child {
  border-bottom: 0;
}

.blog-template__channel-item:hover {
  background: var(--a-color-surface-muted);
}

.blog-template__channel-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.blog-template__channel-name {
  font-size: 0.85rem;
  color: var(--a-color-fg);
  font-weight: 600;
}

.blog-template__channel-desc {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blog-template__channel-subscribers {
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  flex-shrink: 0;
}

.blog-template__rail-note {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  cursor: pointer;
  transition: background 0.15s ease;
}

.blog-template__rail-note:last-child {
  border-bottom: 0;
}

.blog-template__rail-note:hover {
  background: var(--a-color-surface-muted);
}

.blog-template__rail-title {
  font-size: 0.85rem;
  line-height: 1.4;
  font-weight: 550;
  color: var(--a-color-fg);
}

.blog-template__rail-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.blog-template__rail-stats span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

@media (max-width: 1024px) {
  .blog-template__layout {
    grid-template-columns: 1fr;
  }
  .blog-template__rail {
    display: none;
  }
  .blog-template__hero-card {
    grid-template-columns: 1fr;
  }
}
</style>
