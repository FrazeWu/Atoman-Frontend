<template>
  <div class="a-module-layout">
    <!-- 侧边栏：永久展开、单组导航、突出块卡片选中样式 -->
    <aside class="p-sidebar explore-template-sidebar">
      <nav class="p-sidebar-nav" aria-label="博客主要导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="p-sidebar-item explore-template-sidebar__item"
          :class="{ 'active': activeNav === item.to }"
          @click.prevent="activeNav = item.to"
        >
          <span class="p-sidebar-item-icon is-component-icon">
            <component :is="item.icon" class="p-sidebar-item-svg" />
          </span>
          <span class="p-sidebar-item-label">{{ item.label }}</span>
          <span v-if="item.badge" class="explore-template-sidebar__badge" :class="item.badgeType">
            {{ item.badge }}
          </span>
        </RouterLink>
      </nav>
    </aside>

    <!-- 右侧页面主内容 -->
    <main class="a-main-content">
      <div class="a-page explore-template">
        <PPageHeader title="博客探索范例" accent>
          <template #action>
            <PButton outline to="/posts">返回实际博客</PButton>
          </template>
        </PPageHeader>

        <!-- 探索主分类 Tabs -->
        <div class="explore-template__tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="explore-template__tab-btn"
            :class="{ 'is-active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" :size="16" />
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <!-- 主布局：Stream + Sticky Rail -->
        <div class="explore-template__layout">
          <!-- 左侧探索主流 -->
          <main class="explore-template__stream">
            <!-- 专栏/频道探索 Banner 墙 -->
            <section class="explore-template__section">
              <div class="explore-template__section-header">
                <h2>探索精选专栏</h2>
                <span class="explore-template__section-sub">按主题探索深度内容</span>
              </div>

              <div class="explore-template__channels-grid">
                <div
                  v-for="channel in channels"
                  :key="channel.id"
                  class="explore-template__channel-card"
                >
                  <div class="explore-template__channel-banner" :style="{ backgroundImage: `url(${channel.banner})` }">
                    <span class="explore-template__channel-subscribers">{{ channel.subscribers }} 订阅</span>
                  </div>
                  <div class="explore-template__channel-body">
                    <h3 class="explore-template__channel-title">《{{ channel.name }}》</h3>
                    <p class="explore-template__channel-desc">{{ channel.desc }}</p>
                    <div class="explore-template__channel-footer">
                      <span class="explore-template__channel-posts">{{ channel.postCount }} 篇文章</span>
                      <PButton size="sm" :variant="channel.subscribed ? 'secondary' : 'primary'" @click="channel.subscribed = !channel.subscribed">
                        {{ channel.subscribed ? '已订阅' : '订阅专栏' }}
                      </PButton>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- 热门话题 / 标签云墙 -->
            <section class="explore-template__section">
              <div class="explore-template__section-header">
                <h2>热门探索标签</h2>
              </div>
              <div class="explore-template__tags-cloud">
                <span
                  v-for="tag in exploreTags"
                  :key="tag.name"
                  class="explore-template__tag-chip"
                  :class="{ 'is-hot': tag.isHot }"
                >
                  # {{ tag.name }} <small>({{ tag.count }})</small>
                </span>
              </div>
            </section>

            <!-- 探索文章与短笺混合流 -->
            <section class="explore-template__section">
              <div class="explore-template__section-header">
                <h2>最新探索发现</h2>
              </div>

              <div class="explore-template__feed">
                <article
                  v-for="item in exploreFeed"
                  :key="item.id"
                  class="explore-template__feed-card"
                  @click="openPostSheet(item.id, item.title)"
                >
                  <div class="explore-template__feed-main">
                    <div class="explore-template__feed-meta">
                      <PAvatar :src="item.authorAvatar" :name="item.author" size="xs" />
                      <span class="explore-template__author">{{ item.author }}</span>
                      <span class="explore-template__dot">·</span>
                      <span class="explore-template__channel">《{{ item.channel }}》</span>
                      <span class="explore-template__dot">·</span>
                      <time>{{ item.time }}</time>
                    </div>

                    <h3 class="explore-template__feed-title">{{ item.title }}</h3>
                    <p class="explore-template__feed-summary">{{ item.summary }}</p>

                    <div class="explore-template__feed-footer">
                      <div class="explore-template__feed-tags">
                        <span v-for="t in item.tags" :key="t" class="explore-template__tag">#{{ t }}</span>
                      </div>
                      <InteractionBar
                        :liked="item.liked"
                        :like-count="item.likeCount"
                        :comment-count="item.commentCount"
                        @like="item.liked = true; item.likeCount++"
                        @unlike="item.liked = false; item.likeCount--"
                        @comment="openPostSheet(item.id, item.title)"
                      />
                    </div>
                  </div>

                  <div v-if="item.cover" class="explore-template__feed-visual">
                    <img :src="item.cover" :alt="item.title" class="explore-template__feed-cover" />
                  </div>
                </article>
              </div>
            </section>
          </main>

          <!-- 右侧智能推荐 Rail (侧边栏) -->
          <aside class="explore-template__rail" aria-label="探索推荐侧栏">
            <!-- 热门讨论话题榜 -->
            <section class="explore-template__rail-section">
              <div class="explore-template__rail-header">
                <Flame :size="16" class="explore-template__rail-icon is-hot" />
                <h2>热门讨论话题</h2>
              </div>
              <div class="explore-template__rail-list">
                <div
                  v-for="topic in hotTopics"
                  :key="topic.id"
                  class="explore-template__topic-item"
                >
                  <div class="explore-template__topic-info">
                    <strong class="explore-template__topic-name"># {{ topic.name }}</strong>
                    <span class="explore-template__topic-count">{{ topic.discussionCount }} 条讨论</span>
                  </div>
                  <span class="explore-template__topic-trend">🔥 {{ topic.heat }}</span>
                </div>
              </div>
            </section>

            <!-- 推荐关注创作者 -->
            <section class="explore-template__rail-section">
              <div class="explore-template__rail-header">
                <UserCheck :size="16" class="explore-template__rail-icon is-author" />
                <h2>推荐创作者</h2>
              </div>
              <div class="explore-template__rail-list">
                <div
                  v-for="author in recommendedAuthors"
                  :key="author.id"
                  class="explore-template__author-item"
                >
                  <PAvatar :src="author.avatar" :name="author.name" size="sm" />
                  <div class="explore-template__author-info">
                    <strong class="explore-template__author-name">{{ author.name }}</strong>
                    <span class="explore-template__author-bio">{{ author.bio }}</span>
                  </div>
                  <PButton
                    size="sm"
                    :variant="author.followed ? 'secondary' : 'primary'"
                    @click="author.followed = !author.followed"
                  >
                    {{ author.followed ? '已关注' : '关注' }}
                  </PButton>
                </div>
              </div>
            </section>

            <!-- 探索小贴士 / 指南 -->
            <section class="explore-template__rail-section explore-template__rail-card">
              <div class="explore-template__guide-content">
                <Sparkles :size="18" class="explore-template__guide-icon" />
                <h3>探索创作灵感</h3>
                <p>发布你独特的探索见解，优质文章与短笺将获得更多推荐关注。</p>
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
import { Bookmark, Compass, Flame, Hash, MessageSquare, Rss, Sparkles, UserCheck, Users } from 'lucide-vue-next'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useBlogSheets } from '@/composables/useBlogSheets'

const blogSheets = useBlogSheets()
const activeNav = ref('/posts')

const navItems: { to: string; label: string; icon: any; badge?: string; badgeType?: string }[] = [
  { to: '/posts', label: '探索', icon: Compass },
  { to: '/posts/notes', label: '短笺', icon: MessageSquare },
  { to: '/posts/subscriptions', label: '订阅', icon: Rss },
  { to: '/posts/bookmarks', label: '收藏', icon: Bookmark },
]

const activeTab = ref('channels')
const tabs = [
  { id: 'channels', label: '专栏探索', icon: Compass },
  { id: 'topics', label: '话题广场', icon: Hash },
  { id: 'creators', label: '创作者榜', icon: Users },
]

function openPostSheet(id: string, title: string) {
  blogSheets.openPost(id, title)
}

const channels = ref([
  {
    id: 'c1',
    name: '前端设计学',
    desc: '探讨 UI/UX 设计系统、CSS Token 架构与多端响应式体验。',
    subscribers: 1420,
    postCount: 38,
    subscribed: false,
    banner: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'c2',
    name: 'Go 语言与并发',
    desc: '深入 Go 协程调度、内存优化、GORM 数据库实践与微服务架构。',
    subscribers: 980,
    postCount: 52,
    subscribed: true,
    banner: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'c3',
    name: 'AI 与未来逻辑',
    desc: '探索 LLM 智能 Agent、自动化 Workflow 与前沿 AI 算法。',
    subscribers: 2150,
    postCount: 64,
    subscribed: false,
    banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
  },
])

const exploreTags = [
  { name: 'UI设计', count: 142, isHot: true },
  { name: 'Vue3.5', count: 98, isHot: true },
  { name: 'Go后端', count: 86, isHot: false },
  { name: 'TypeScript', count: 120, isHot: true },
  { name: 'Cloudflare', count: 45, isHot: false },
  { name: '系统设计', count: 67, isHot: false },
  { name: 'AI智能Agent', count: 210, isHot: true },
]

const exploreFeed = ref([
  {
    id: 'ef-1',
    title: '卡片化设计在现代化 Web App 中的多维度呼吸感探索',
    summary: '深入探讨如何通过边框、浅色阴影、内边距与字体层级建立富有弹性的沉浸式卡片UI。',
    channel: '前端设计学',
    author: 'Design Lead',
    authorAvatar: '',
    cover: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=400&q=80',
    tags: ['UI设计', '呼吸感'],
    time: '10 分钟前',
    liked: false,
    likeCount: 19,
    commentCount: 4,
  },
  {
    id: 'ef-2',
    title: '从并发模型探讨 Go 与 Rust 在高吞吐架构下的性能对比',
    summary: '通过真实的压力测试数据，对比 Goroutine 与 async/await 在内存与系统调度上的异同。',
    channel: 'Go 语言与并发',
    author: 'Arch Tech',
    authorAvatar: '',
    cover: '',
    tags: ['Go', 'Rust', '并发'],
    time: '1 小时前',
    liked: true,
    likeCount: 54,
    commentCount: 17,
  },
])

const hotTopics = [
  { id: 't1', name: '短笺页设计重构规范', discussionCount: 128, heat: '9.8k' },
  { id: 't2', name: 'Vue 3.5 响应式机制', discussionCount: 94, heat: '7.2k' },
  { id: 't3', name: 'Go 架构最佳实践', discussionCount: 65, heat: '5.1k' },
]

const recommendedAuthors = ref([
  { id: 'a1', name: 'Alex Chen', bio: '资深 UI/UX 设计师与前端工程师', avatar: '', followed: false },
  { id: 'a2', name: 'Go Master', bio: 'Go 核心贡献者与云原生专家', avatar: '', followed: true },
  { id: 'a3', name: 'AI Researcher', bio: '专注于大模型 Agent 架构', avatar: '', followed: false },
])
</script>

<style scoped>
/* 侧边栏：永久展开、突出块卡片形式 */
.explore-template-sidebar {
  width: 13.5rem;
  border-right: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.explore-template-sidebar__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.85rem;
  padding: 0.65rem 1rem;
  margin-bottom: 0.45rem;
  color: var(--a-color-text-secondary);
  border-radius: var(--a-radius-card);
  border: 1px solid transparent;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.explore-template-sidebar__item:hover {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
}

/* 突出块卡片选中效果 */
.explore-template-sidebar__item.active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-weight: 650;
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.explore-template-sidebar__item.active::before {
  display: none !important;
}

.explore-template-sidebar__badge {
  margin-left: auto;
  padding: 0.15rem 0.45rem;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: var(--a-radius-pill);
  line-height: 1;
}

.explore-template-sidebar__badge.is-hot {
  color: var(--a-color-warning);
  background: rgba(245, 158, 11, 0.12);
}

.explore-template-sidebar__badge.is-count,
.explore-template-sidebar__badge.is-unread {
  color: var(--a-color-text-secondary);
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
}

/* 主页面样式 */
.explore-template {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

/* Tabs */
.explore-template__tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 0.75rem;
}

.explore-template__tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--a-radius-pill);
  cursor: pointer;
  transition: all 0.15s ease;
}

.explore-template__tab-btn:hover {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
}

.explore-template__tab-btn.is-active {
  color: var(--a-color-bg);
  background: var(--a-color-text);
}

/* 主布局 */
.explore-template__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 2rem;
  align-items: start;
}

.explore-template__stream {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.explore-template__section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.explore-template__section-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.explore-template__section-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.explore-template__section-sub {
  font-size: 0.78rem;
  color: var(--a-color-muted);
}

/* 专栏网格 */
.explore-template__channels-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.explore-template__channel-card {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.explore-template__channel-card:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.explore-template__channel-banner {
  position: relative;
  height: 6rem;
  background-size: cover;
  background-position: center;
  background-color: var(--a-color-surface-muted);
}

.explore-template__channel-subscribers {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  border-radius: var(--a-radius-control);
}

.explore-template__channel-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.explore-template__channel-title {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.explore-template__channel-desc {
  margin: 0 0 1rem;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.explore-template__channel-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.explore-template__channel-posts {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

/* 标签云墙 */
.explore-template__tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.explore-template__tag-chip {
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  color: var(--a-color-text);
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: all 0.15s ease;
}

.explore-template__tag-chip:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.explore-template__tag-chip.is-hot {
  border-color: rgba(225, 29, 72, 0.25);
  background: rgba(225, 29, 72, 0.04);
  color: var(--a-color-fg);
}

.explore-template__tag-chip small {
  color: var(--a-color-muted);
}

/* 文章列表 */
.explore-template__feed {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.explore-template__feed-card {
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

.explore-template__feed-card:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.explore-template__feed-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--a-color-text-secondary);
  margin-bottom: 0.45rem;
}

.explore-template__author {
  font-weight: 500;
  color: var(--a-color-text);
}

.explore-template__channel {
  color: var(--a-color-primary);
  font-weight: 500;
}

.explore-template__dot {
  color: var(--a-color-muted-soft);
}

.explore-template__feed-title {
  margin: 0 0 0.45rem;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.45;
  color: var(--a-color-fg);
}

.explore-template__feed-summary {
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

.explore-template__feed-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.explore-template__feed-tags {
  display: flex;
  gap: 0.4rem;
}

.explore-template__tag {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.explore-template__feed-visual {
  width: 7.5rem;
  height: 7.5rem;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  flex-shrink: 0;
}

.explore-template__feed-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.explore-template__feed-card:hover .explore-template__feed-cover {
  transform: scale(1.04);
}

/* 侧轨 Sticky Rail */
.explore-template__rail {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.explore-template__rail-section {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
}

.explore-template__rail-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.explore-template__rail-header h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.explore-template__rail-icon.is-hot {
  color: var(--a-color-warning);
}

.explore-template__rail-icon.is-author {
  color: var(--a-color-primary);
}

.explore-template__rail-list {
  display: flex;
  flex-direction: column;
}

.explore-template__topic-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  transition: background 0.15s ease;
}

.explore-template__topic-item:last-child {
  border-bottom: 0;
}

.explore-template__topic-item:hover {
  background: var(--a-color-surface-muted);
}

.explore-template__topic-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.explore-template__topic-name {
  font-size: 0.85rem;
  color: var(--a-color-fg);
  font-weight: 600;
}

.explore-template__topic-count {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.explore-template__topic-trend {
  font-size: 0.75rem;
  color: var(--a-color-warning);
  font-weight: 500;
}

.explore-template__author-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.explore-template__author-item:last-child {
  border-bottom: 0;
}

.explore-template__author-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.explore-template__author-name {
  font-size: 0.85rem;
  color: var(--a-color-fg);
  font-weight: 600;
}

.explore-template__author-bio {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.explore-template__rail-card {
  padding: 1.25rem;
  background: var(--a-color-surface-muted);
}

.explore-template__guide-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
}

.explore-template__guide-icon {
  color: var(--a-color-primary);
}

.explore-template__guide-content h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.explore-template__guide-content p {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--a-color-text-secondary);
}

@media (max-width: 1024px) {
  .explore-template__layout {
    grid-template-columns: 1fr;
  }
  .explore-template__rail {
    display: none;
  }
  .explore-template__channels-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .explore-template__channels-grid {
    grid-template-columns: 1fr;
  }
}
</style>
