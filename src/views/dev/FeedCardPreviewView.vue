<template>
  <div class="discover-preview-root">
    <!-- 顶部全局方案切换器 -->
    <header class="discover-preview-header">
      <div class="discover-preview-header__main">
        <h1>发现页全新设计方案对比与评审</h1>
        <p>点击下方按钮直接切换体验 3 种完全不同的发现页交互架构原型：</p>
      </div>

      <div class="prototype-switch-bar">
        <button
          v-for="proto in prototypeOptions"
          :key="proto.id"
          class="proto-btn"
          :class="{ 'is-active': activeProto === proto.id }"
          @click="activeProto = proto.id"
        >
          <span class="proto-btn__icon">{{ proto.icon }}</span>
          <span class="proto-btn__name">{{ proto.name }}</span>
          <span class="proto-btn__tag">{{ proto.tag }}</span>
        </button>
      </div>

      <div class="proto-desc-box">
        <strong>{{ currentProtoMeta.name }}：{{ currentProtoMeta.summary }}</strong>
        <p>{{ currentProtoMeta.details }}</p>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════════
         方案 1：双并列信息流（Dual Parallel Streams）
         ═══════════════════════════════════════════════════════════════ -->
    <main v-if="activeProto === 'curated'" class="discover-layout dual-stream-flow">
      <!-- 顶部搜索与全局主题胶囊 -->
      <div class="dual-stream-head">
        <div class="curated-search">
          <Search :size="16" class="search-icon" />
          <input
            v-model="curatedSearch"
            type="search"
            placeholder="搜索全网文章、专栏、RSS 订阅源与播客..."
          />
        </div>

        <div class="curated-topics">
          <button
            v-for="topic in curatedTopics"
            :key="topic.id"
            class="topic-pill"
            :class="{ 'is-active': activeTopic === topic.id }"
            @click="activeTopic = topic.id"
          >
            {{ topic.name }}
          </button>
        </div>
      </div>

      <!-- 左右双并列信息流 -->
      <div class="dual-streams-container">
        <!-- 左侧信息流：🔥 精选热门文章流 -->
        <section class="stream-column">
          <div class="stream-column__head">
            <div class="stream-column__title-group">
              <span class="section-badge section-badge--hot">ARTICLES</span>
              <h2>精选热门文章</h2>
              <span class="stream-count">128 篇</span>
            </div>
            <div class="stream-sub-filters">
              <button class="mini-filter is-active">最新</button>
              <button class="mini-filter">最热</button>
            </div>
          </div>

          <div class="feed-timeline-box">
            <PEntry
              v-for="item in mockArticles"
              :key="item.id"
              :title="item.title"
              :summary="item.summary"
              :is-read="item.isRead"
              class="content-stream-entry"
            >
              <template #meta>
                <span class="a-label feed-source-link">{{ item.source }}</span>
                <span class="feed-meta-stat"><Eye :size="11" />{{ item.views }}</span>
                <span class="feed-meta-stat"><Gauge :size="11" />{{ item.rating }}</span>
                <span class="feed-meta-stat"><Bookmark :size="11" />{{ item.bookmarks }}</span>
                <span style="color:var(--a-color-muted-soft)">{{ item.date }}</span>
                <span class="feed-type-tag" :class="item.badgeType === 'blog' ? 'feed-type-tag--blog' : 'feed-type-tag--rss'">
                  {{ item.badge }}
                </span>
              </template>
              <template #actions>
                <button class="mock-clip-btn" title="收藏"><Bookmark :size="14" /></button>
                <button class="mock-clip-btn" title="稍后阅读"><Clock :size="14" /></button>
              </template>
            </PEntry>
          </div>
        </section>

        <!-- 右侧信息流：💡 优质频道/源推荐流 -->
        <section class="stream-column">
          <div class="stream-column__head">
            <div class="stream-column__title-group">
              <span class="section-badge">CHANNELS</span>
              <h2>优质频道与源</h2>
              <span class="stream-count">24 个</span>
            </div>
            <div class="stream-sub-filters">
              <button class="mini-filter is-active">推荐</button>
              <button class="mini-filter">最多订阅</button>
            </div>
          </div>

          <div class="channels-stack">
            <article
              v-for="src in mockChannels"
              :key="src.id"
              class="feed-source-card"
              tabindex="0"
            >
              <div class="feed-source-card__header">
                <div class="feed-source-card__avatar" :style="{ '--feed-source-color': src.color }">
                  <img v-if="src.image" :src="src.image" :alt="src.title" />
                  <span v-else>{{ src.initials }}</span>
                </div>
                <div class="feed-source-card__info">
                  <div class="feed-source-card__title-row">
                    <h3 class="feed-source-card__title">{{ src.title }}</h3>
                    <span class="feed-source-card__tag">{{ src.categoryLabel }}</span>
                  </div>
                  <p class="feed-source-card__summary">{{ src.summary }}</p>
                </div>
                <button
                  type="button"
                  class="feed-source-card__sub-btn"
                  :class="{ 'is-subscribed': src.subscribed }"
                  @click.stop="src.subscribed = !src.subscribed"
                >
                  <Check v-if="src.subscribed" :size="13" />
                  <Plus v-else :size="13" />
                  <span>{{ src.subscribed ? '已订阅' : '订阅' }}</span>
                </button>
              </div>

              <ul v-if="src.previews.length" class="feed-source-card__previews">
                <li v-for="p in src.previews.slice(0, 2)" :key="p">
                  <span class="preview-bullet">›</span>
                  <span class="preview-title">{{ p }}</span>
                </li>
              </ul>

              <div class="feed-source-card__footer">
                <span class="footer-stat"><Users :size="12" />{{ src.subCount }} 订阅</span>
                <span class="footer-stat"><FileText :size="12" />{{ src.recentCount }} 篇近期</span>
                <span class="footer-stat"><Clock :size="12" />{{ src.updatedTime }}</span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>

    <!-- ═══════════════════════════════════════════════════════════════
         方案 2：分栏 Tab 极简型（Tabbed Minimal Explore）
         ═══════════════════════════════════════════════════════════════ -->
    <main v-else-if="activeProto === 'tabbed'" class="discover-layout tabbed-flow">
      <!-- 顶部单行集成 Toolbar -->
      <div class="tabbed-toolbar">
        <div class="tabbed-toolbar__tabs">
          <button
            class="tab-item"
            :class="{ 'is-active': activeExploreTab === 'channels' }"
            @click="activeExploreTab = 'channels'"
          >
            <Radio :size="15" />
            <span>频道推荐</span>
            <span class="tab-item__count">24</span>
          </button>
          <button
            class="tab-item"
            :class="{ 'is-active': activeExploreTab === 'articles' }"
            @click="activeExploreTab = 'articles'"
          >
            <FileText :size="15" />
            <span>热门文章</span>
            <span class="tab-item__count">128</span>
          </button>
          <button
            class="tab-item"
            :class="{ 'is-active': activeExploreTab === 'square' }"
            @click="activeExploreTab = 'square'"
          >
            <Compass :size="15" />
            <span>订阅源广场 (批量)</span>
          </button>
        </div>

        <div class="tabbed-toolbar__search">
          <Search :size="14" class="search-icon" />
          <input v-model="tabbedSearch" type="search" placeholder="筛选列表..." />
        </div>
      </div>

      <!-- Tab 1 内容：纯频道推荐网格 -->
      <div v-if="activeExploreTab === 'channels'" class="tab-view">
        <div class="tab-sub-filter">
          <span class="filter-hint">分类筛选：</span>
          <button
            v-for="c in channelCategories"
            :key="c.id"
            class="sub-filter-pill"
            :class="{ 'is-active': activeCategoryFilter === c.id }"
            @click="activeCategoryFilter = c.id"
          >
            {{ c.name }}
          </button>
        </div>

        <div class="channels-grid-2col">
          <article
            v-for="src in filteredMockChannels"
            :key="src.id"
            class="feed-source-card"
            tabindex="0"
          >
            <div class="feed-source-card__header">
              <div class="feed-source-card__avatar" :style="{ '--feed-source-color': src.color }">
                <img v-if="src.image" :src="src.image" :alt="src.title" />
                <span v-else>{{ src.initials }}</span>
              </div>
              <div class="feed-source-card__info">
                <div class="feed-source-card__title-row">
                  <h3 class="feed-source-card__title">{{ src.title }}</h3>
                  <span class="feed-source-card__tag">{{ src.categoryLabel }}</span>
                </div>
                <p class="feed-source-card__summary">{{ src.summary }}</p>
              </div>
              <button
                type="button"
                class="feed-source-card__sub-btn"
                :class="{ 'is-subscribed': src.subscribed }"
                @click.stop="src.subscribed = !src.subscribed"
              >
                <Check v-if="src.subscribed" :size="13" />
                <Plus v-else :size="13" />
                <span>{{ src.subscribed ? '已订阅' : '订阅' }}</span>
              </button>
            </div>

            <ul v-if="src.previews.length" class="feed-source-card__previews">
              <li v-for="p in src.previews.slice(0, 2)" :key="p">
                <span class="preview-bullet">›</span>
                <span class="preview-title">{{ p }}</span>
              </li>
            </ul>

            <div class="feed-source-card__footer">
              <span class="footer-stat"><Users :size="12" />{{ src.subCount }} 订阅</span>
              <span class="footer-stat"><FileText :size="12" />{{ src.recentCount }} 篇近期</span>
              <span class="footer-stat"><Clock :size="12" />{{ src.updatedTime }}</span>
            </div>
          </article>
        </div>
      </div>

      <!-- Tab 2 内容：纯热门文章流 -->
      <div v-else-if="activeExploreTab === 'articles'" class="tab-view">
        <div class="feed-timeline-box">
          <PEntry
            v-for="item in mockArticles"
            :key="item.id"
            :title="item.title"
            :summary="item.summary"
            :is-read="item.isRead"
            class="content-stream-entry"
          >
            <template #meta>
              <span class="a-label feed-source-link">{{ item.source }}</span>
              <span class="feed-meta-stat"><Eye :size="11" />{{ item.views }}</span>
              <span class="feed-meta-stat"><Gauge :size="11" />{{ item.rating }}</span>
              <span class="feed-meta-stat"><Bookmark :size="11" />{{ item.bookmarks }}</span>
              <span style="color:var(--a-color-muted-soft)">{{ item.date }}</span>
              <span class="feed-type-tag" :class="item.badgeType === 'blog' ? 'feed-type-tag--blog' : 'feed-type-tag--rss'">
                {{ item.badge }}
              </span>
            </template>
          </PEntry>
        </div>
      </div>

      <!-- Tab 3 内容：订阅源广场（批量勾选订阅） -->
      <div v-else class="tab-view">
        <div class="batch-toolbar">
          <label class="batch-select-all">
            <input type="checkbox" v-model="allSelected" @change="toggleSelectAll" />
            <span>全选当前页 ({{ selectedSourceIds.length }}/{{ mockChannels.length }})</span>
          </label>
          <button
            class="batch-sub-btn"
            :disabled="!selectedSourceIds.length"
            @click="batchSubscribe"
          >
            订阅选中源 ({{ selectedSourceIds.length }})
          </button>
        </div>

        <div class="batch-sources-list">
          <div
            v-for="src in mockChannels"
            :key="src.id"
            class="batch-source-row"
            :class="{ 'is-selected': selectedSourceIds.includes(src.id) }"
            @click="toggleSourceSelection(src.id)"
          >
            <input
              type="checkbox"
              :checked="selectedSourceIds.includes(src.id)"
              :disabled="src.subscribed"
              @click.stop
              @change="toggleSourceSelection(src.id)"
            />
            <div class="batch-source-row__avatar" :style="{ '--feed-source-color': src.color }">
              {{ src.initials }}
            </div>
            <div class="batch-source-row__info">
              <strong>{{ src.title }}</strong>
              <small>{{ src.summary }}</small>
            </div>
            <span class="src-type-tag">{{ src.categoryLabel }}</span>
            <span class="batch-source-row__subs">{{ src.subCount }} 订阅</span>
            <span v-if="src.subscribed" class="batch-status-tag">已订阅</span>
          </div>
        </div>
      </div>
    </main>

    <!-- ═══════════════════════════════════════════════════════════════
         方案 3：全景双栏仪表盘型（Dashboard / Split View）
         ═══════════════════════════════════════════════════════════════ -->
    <main v-else class="discover-layout dashboard-flow">
      <!-- 左主栏 (65%)：热门与精选文章信息流 -->
      <div class="dashboard-main">
        <div class="dashboard-main__head">
          <h2>🔥 热门精选内容</h2>
          <div class="dashboard-sub-tabs">
            <button class="sub-tab is-active">最新推荐</button>
            <button class="sub-tab">讨论最多</button>
            <button class="sub-tab">高分精选</button>
          </div>
        </div>

        <div class="feed-timeline-box">
          <PEntry
            v-for="item in mockArticles"
            :key="item.id"
            :title="item.title"
            :summary="item.summary"
            :is-read="item.isRead"
            class="content-stream-entry"
          >
            <template #meta>
              <span class="a-label feed-source-link">{{ item.source }}</span>
              <span class="feed-meta-stat"><Eye :size="11" />{{ item.views }}</span>
              <span class="feed-meta-stat"><Gauge :size="11" />{{ item.rating }}</span>
              <span class="feed-meta-stat"><Bookmark :size="11" />{{ item.bookmarks }}</span>
              <span style="color:var(--a-color-muted-soft)">{{ item.date }}</span>
              <span class="feed-type-tag" :class="item.badgeType === 'blog' ? 'feed-type-tag--blog' : 'feed-type-tag--rss'">
                {{ item.badge }}
              </span>
            </template>
          </PEntry>
        </div>
      </div>

      <!-- 右侧栏 (35%)：优质频道榜与快捷探索 -->
      <aside class="dashboard-sidebar">
        <!-- 侧栏模块 1：新星频道推荐 -->
        <div class="sidebar-box">
          <div class="sidebar-box__head">
            <h3>💡 值得关注的频道</h3>
            <button class="more-link">换一批</button>
          </div>
          <div class="sidebar-channels-list">
            <article
              v-for="src in mockChannels.slice(0, 3)"
              :key="src.id"
              class="sidebar-channel-card"
            >
              <div class="sidebar-channel-card__top">
                <div class="sidebar-channel-card__avatar" :style="{ '--feed-source-color': src.color }">
                  {{ src.initials }}
                </div>
                <div class="sidebar-channel-card__text">
                  <h4>{{ src.title }}</h4>
                  <small>{{ src.categoryLabel }} · {{ src.subCount }} 订阅</small>
                </div>
                <button
                  class="compact-sub-btn"
                  :class="{ 'is-subscribed': src.subscribed }"
                  @click="src.subscribed = !src.subscribed"
                >
                  <Check v-if="src.subscribed" :size="12" />
                  <Plus v-else :size="12" />
                  <span>{{ src.subscribed ? '已订阅' : '订阅' }}</span>
                </button>
              </div>
              <p class="sidebar-channel-card__desc">{{ src.summary }}</p>
            </article>
          </div>
        </div>

        <!-- 侧栏模块 2：热门话题词云 -->
        <div class="sidebar-box">
          <div class="sidebar-box__head">
            <h3>🏷 热门探索标签</h3>
          </div>
          <div class="tag-cloud">
            <button v-for="t in tagCloud" :key="t.name" class="tag-cloud-item">
              <span># {{ t.name }}</span>
              <small>{{ t.count }}</small>
            </button>
          </div>
        </div>

        <!-- 侧栏模块 3：快捷导入/添加入口 -->
        <div class="sidebar-box sidebar-box--promo">
          <h4>你有喜欢的 RSS 或博客？</h4>
          <p>支持一键导入 OPML 或输入网址自动解析订阅源。</p>
          <button class="promo-btn">+ 导入 / 添加订阅源</button>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Bookmark,
  Check,
  Clock,
  Compass,
  FileText,
  Gauge,
  Eye,
  Plus,
  Radio,
  Search,
  Users,
} from 'lucide-vue-next'
import PEntry from '@/components/ui/PEntry.vue'

// ── 方案定义 ──
const prototypeOptions = [
  {
    id: 'curated' as const,
    icon: '✨',
    name: '方案 1：主题流式策展页',
    tag: '现代发现体验 · 推荐',
    summary: '类似 Substack / Linear Discover',
    details: '全宽纵向策展流：搜索与主题胶囊 → 精选频道展台（方案 B 双列网格）→ 今日热门文章流。浏览节奏极好，有深度有导读。',
  },
  {
    id: 'tabbed' as const,
    icon: '📑',
    name: '方案 2：分栏 Tab 极简型',
    tag: '结构极其清晰 · 高效',
    summary: '类似 Reeder / Feedly 分类汇聚',
    details: '三大清晰 Tab 切换（频道推荐 / 热门文章 / 订阅源广场），各 Tab 各司其职，无嵌套多重选择器，支持批量快速订阅。',
  },
  {
    id: 'dashboard' as const,
    icon: '📊',
    name: '方案 3：全景双栏仪表盘',
    tag: '宽屏高密度 · 一屏全览',
    summary: '主内容流 + 侧边栏榜单与标签云',
    details: '左栏为热门文章大信息流，右栏紧凑排布推荐频道、热门 Tag 标签云与快速导入入口，一屏看全所有发现维度的内容。',
  },
]

const activeProto = ref<'curated' | 'tabbed' | 'dashboard'>('curated')

const currentProtoMeta = computed(() => {
  return prototypeOptions.find(p => p.id === activeProto.value) || prototypeOptions[0]
})

// ── 方案 1 数据 ──
const curatedSearch = ref('')
const activeTopic = ref('all')
const curatedTopics = [
  { id: 'all', name: '全部探索' },
  { id: 'ai', name: 'AI & 大模型' },
  { id: 'eng', name: '软件工程' },
  { id: 'design', name: '现代设计' },
  { id: 'indie', name: '独立开发' },
  { id: 'podcast', name: '深度播客' },
]

// ── 方案 2 数据 ──
const activeExploreTab = ref<'channels' | 'articles' | 'square'>('channels')
const tabbedSearch = ref('')
const activeCategoryFilter = ref('all')
const channelCategories = [
  { id: 'all', name: '全部分类' },
  { id: 'blog', name: '个人博客' },
  { id: 'tech', name: '技术资讯' },
  { id: 'podcast', name: '播客频道' },
  { id: 'design', name: '设计前沿' },
]

const allSelected = ref(false)
const selectedSourceIds = ref<string[]>([])

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedSourceIds.value = mockChannels.value.filter(s => !s.subscribed).map(s => s.id)
  } else {
    selectedSourceIds.value = []
  }
}

const toggleSourceSelection = (id: string) => {
  const src = mockChannels.value.find(s => s.id === id)
  if (src?.subscribed) return
  if (selectedSourceIds.value.includes(id)) {
    selectedSourceIds.value = selectedSourceIds.value.filter(item => item !== id)
    allSelected.value = false
  } else {
    selectedSourceIds.value.push(id)
    if (selectedSourceIds.value.length === mockChannels.value.filter(s => !s.subscribed).length) {
      allSelected.value = true
    }
  }
}

const batchSubscribe = () => {
  mockChannels.value.forEach(s => {
    if (selectedSourceIds.value.includes(s.id)) {
      s.subscribed = true
    }
  })
  selectedSourceIds.value = []
  allSelected.value = false
}

// ── 方案 3 数据 ──
const tagCloud = [
  { name: 'Rust', count: 142 },
  { name: 'Vue 3', count: 98 },
  { name: 'AI Agent', count: 210 },
  { name: 'LLM 系统', count: 85 },
  { name: 'UI/UX 排版', count: 64 },
  { name: '独立变现', count: 52 },
]

// ── Mock 核心数据 ──
const mockChannels = ref([
  {
    id: '1',
    title: 'The Pragmatic Engineer',
    summary: '深度大厂软件工程实践、系统架构演进与工程师职业进阶指南。',
    categoryLabel: '个人博客',
    initials: 'PE',
    color: '#3b82f6',
    image: '',
    subCount: '12.4K',
    recentCount: 8,
    updatedTime: '2天前更新',
    subscribed: false,
    previews: [
      '为什么高级工程师写更少代码但创造更多业务价值',
      'Staff Engineer 晋升后的真实日常与技术权衡',
    ],
  },
  {
    id: '2',
    title: 'Hacker Newsletter',
    summary: 'Hacker News 每周精选，覆盖系统架构、底层工具与开源前沿。',
    categoryLabel: '技术资讯',
    initials: 'HN',
    color: '#f97316',
    image: '',
    subCount: '8.1K',
    recentCount: 12,
    updatedTime: '昨天更新',
    subscribed: true,
    previews: [
      'Show HN: 用 Rust 从零编写的高性能终端音频流引擎',
      'Ask HN: 在 2025 年你如何搭建自托管个人知识库？',
    ],
  },
  {
    id: '3',
    title: 'CSS-Tricks & Web Frontend',
    summary: '现代 Web 标准演进、CSS 现代排版布局与前端性能优化前线。',
    categoryLabel: '技术资讯',
    initials: 'CT',
    color: '#10b981',
    image: '',
    subCount: '34K',
    recentCount: 5,
    updatedTime: '3天前更新',
    subscribed: false,
    previews: [
      '深入理解 CSS Anchor Positioning 与 Popover API',
      'Container Queries 实战：彻底摆脱传统媒体查询的局限',
    ],
  },
  {
    id: '4',
    title: 'Dan Carlin Hardcore History',
    summary: 'Dan Carlin 主持的深度沉浸式历史播客，单期时长超 4 小时。',
    categoryLabel: '播客频道',
    initials: 'HH',
    color: '#ef4444',
    image: '',
    subCount: '48K',
    recentCount: 3,
    updatedTime: '1周前更新',
    subscribed: false,
    previews: [
      'Episode 71: Twilight of the Empires (Part 3)',
      'Bonus: The Strategy of Ancient Logistics',
    ],
  },
])

const filteredMockChannels = computed(() => {
  const q = tabbedSearch.value.trim().toLowerCase()
  return mockChannels.value.filter(s => {
    const matchQuery = !q || s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q)
    const matchCat =
      activeCategoryFilter.value === 'all' ||
      (activeCategoryFilter.value === 'blog' && s.categoryLabel.includes('博客')) ||
      (activeCategoryFilter.value === 'tech' && s.categoryLabel.includes('资讯')) ||
      (activeCategoryFilter.value === 'podcast' && s.categoryLabel.includes('播客'))
    return matchQuery && matchCat
  })
})

const mockArticles = ref([
  {
    id: 1,
    title: 'Rust 异步运行时深度解析：Tokio 与 async-std 的架构差异',
    summary: '本文从调度器设计、任务窃取、I/O 驱动三个维度对比两大主流异步运行时的实现选择与性能取舍。',
    source: 'The Rust Programming Language Blog',
    date: '8月22日',
    badge: '外部',
    badgeType: 'external' as const,
    isRead: false,
    views: 2341,
    rating: '4.8 (12)',
    bookmarks: 87,
  },
  {
    id: 2,
    title: '2025 年前端工程化现状报告：Vite 生态的全面胜利',
    summary: '年度调查显示，Vite 在新项目中的使用率首次超过 Webpack，成为前端工程化的新默认选择。',
    source: 'State of JS',
    date: '8月21日',
    badge: '外部',
    badgeType: 'external' as const,
    isRead: true,
    views: 5812,
    rating: '4.5 (34)',
    bookmarks: 203,
  },
  {
    id: 3,
    title: '为什么我最终放弃了微服务架构，重回模块化单体',
    summary: '五年微服务实践后，作者回顾了网络复杂性、分布式事务和运维成本带来的真实教训与架构反思。',
    source: '编程随想',
    date: '8月20日',
    badge: '文章',
    badgeType: 'blog' as const,
    isRead: false,
    views: 1024,
    rating: '—',
    bookmarks: 45,
  },
  {
    id: 4,
    title: 'CSS Anchor Positioning 正式落地：绝对定位的终结者？',
    summary: '随着 Chrome 稳定版全面支持，CSS Anchor Positioning 成为首个真正强大的跨浏览器锚点布局规范。',
    source: 'web.dev',
    date: '8月19日',
    badge: '外部',
    badgeType: 'external' as const,
    isRead: true,
    views: 3190,
    rating: '4.2 (8)',
    bookmarks: 116,
  },
])
</script>

<style scoped>
.discover-preview-root {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 6rem;
  display: grid;
  gap: 2.5rem;
}

/* 顶部原型切换器 */
.discover-preview-header {
  display: grid;
  gap: 1rem;
}
.discover-preview-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}
.discover-preview-header p {
  color: var(--a-color-muted);
  font-size: 0.88rem;
  margin: 0;
}

.prototype-switch-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}
.proto-btn {
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem 1rem;
  text-align: left;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  cursor: pointer;
  transition: all 0.18s ease;
}
.proto-btn:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}
.proto-btn.is-active {
  border-color: var(--a-color-text);
  background: var(--a-color-surface);
  box-shadow: inset 4px 0 0 var(--a-color-text), 0 2px 8px rgba(0, 0, 0, 0.04);
}
.proto-btn__icon { font-size: 1.1rem; }
.proto-btn__name { font-size: 0.95rem; font-weight: 650; color: var(--a-color-fg); }
.proto-btn__tag { font-size: 0.72rem; color: var(--a-color-muted); }

.proto-desc-box {
  padding: 0.85rem 1.1rem;
  border-left: 3px solid var(--a-color-text);
  background: var(--a-color-surface-muted);
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
  font-size: 0.85rem;
}
.proto-desc-box strong { color: var(--a-color-fg); display: block; margin-bottom: 0.25rem; }
.proto-desc-box p { margin: 0; color: var(--a-color-muted); font-size: 0.8rem; }

/* ═══════════════════════════════════════════════════════════════════
   方案 1：双并列信息流样式（Dual Stream Flow）
   ═══════════════════════════════════════════════════════════════════ */
.dual-stream-flow {
  display: grid;
  gap: 2rem;
}

.dual-stream-head {
  display: grid;
  gap: 1rem;
}
.curated-search {
  position: relative;
  display: flex;
  align-items: center;
}
.curated-search .search-icon {
  position: absolute;
  left: 0.85rem;
  color: var(--a-color-muted);
}
.curated-search input {
  width: 100%;
  height: 2.75rem;
  padding: 0 1rem 0 2.4rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  font-size: 0.92rem;
  color: var(--a-color-fg);
  outline: none;
  transition: border-color 0.15s ease;
}
.curated-search input:focus { border-color: var(--a-color-text); }

.curated-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.topic-pill {
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 999px;
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  font-size: 0.8rem;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.15s ease;
}
.topic-pill:hover { color: var(--a-color-fg); border-color: var(--a-color-border); }
.topic-pill.is-active {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
}

/* 左右双并列容器 */
.dual-streams-container {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  align-items: start;
  gap: 1.75rem;
}

.stream-column {
  display: grid;
  gap: 1rem;
}

.stream-column__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 0.5rem;
}

.stream-column__title-group {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.stream-column__title-group h2 {
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0;
}

.stream-count {
  font-size: 0.75rem;
  color: var(--a-color-muted-soft);
}

.stream-sub-filters {
  display: flex;
  gap: 0.3rem;
}

.mini-filter {
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  border: 1px solid transparent;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.mini-filter:hover { color: var(--a-color-fg); }
.mini-filter.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-weight: 600;
  border-color: var(--a-color-border-soft);
}

.channels-stack {
  display: grid;
  gap: 0.75rem;
}

.flow-section__title-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.flow-section__title-group h2 {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
}
.section-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.15em 0.5em;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  letter-spacing: 0.05em;
}
.section-badge--hot {
  background: color-mix(in srgb, #ea580c 15%, transparent);
  color: #ea580c;
}
.flow-section__link {
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  cursor: pointer;
}
.flow-section__link:hover { color: var(--a-color-text); }

/* 双列频道网格 */
.channels-grid-2col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

/* 方案 B 频道卡片样式 */
.feed-source-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  cursor: pointer;
  transition: all 0.18s ease;
}
.feed-source-card:hover {
  border-color: var(--a-color-border);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}
.feed-source-card__header {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 0.75rem;
}
.feed-source-card__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--feed-source-color) 18%, var(--a-color-bg));
  color: color-mix(in srgb, var(--feed-source-color) 75%, var(--a-color-fg));
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}
.feed-source-card__avatar img { width: 100%; height: 100%; object-fit: cover; }
.feed-source-card__info { min-width: 0; display: grid; gap: 0.2rem; }
.feed-source-card__title-row { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
.feed-source-card__title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--a-color-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.feed-source-card__tag {
  display: inline-flex;
  padding: 0.1em 0.45em;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--a-color-surface-muted);
  color: var(--a-color-muted);
  white-space: nowrap;
}
.feed-source-card__summary {
  margin: 0;
  font-size: 0.76rem;
  color: var(--a-color-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.feed-source-card__sub-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.85rem;
  padding: 0 0.65rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.feed-source-card__sub-btn:hover {
  background: var(--a-color-surface-muted);
}
.feed-source-card__sub-btn.is-subscribed {
  color: #10b981;
  border-color: color-mix(in srgb, #10b981 40%, var(--a-color-border-soft));
  background: color-mix(in srgb, #10b981 8%, transparent);
}
.feed-source-card__previews {
  margin: 0;
  padding: 0.4rem 0.65rem;
  list-style: none;
  background: var(--a-color-surface-muted);
  border-radius: calc(var(--a-radius-control) - 2px);
  display: grid;
  gap: 0.25rem;
}
.feed-source-card__previews li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  color: var(--a-color-fg);
  min-width: 0;
}
.preview-bullet { color: var(--a-color-muted-soft); font-weight: bold; flex-shrink: 0; }
.preview-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feed-source-card__footer {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.7rem;
  color: var(--a-color-muted-soft);
}
.footer-stat { display: inline-flex; align-items: center; gap: 0.25rem; white-space: nowrap; }

/* 文章列表容器 */
.feed-timeline-box {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
}
.feed-meta-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
}
.feed-type-tag {
  display: inline-flex;
  padding: 0.1em 0.45em;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
}
.feed-type-tag--blog { background: color-mix(in srgb, #16a34a 12%, transparent); color: #16a34a; }
.feed-type-tag--rss  { background: color-mix(in srgb, #2563eb 12%, transparent); color: #2563eb; }
.mock-clip-btn {
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  padding: 0.25rem;
}
.mock-clip-btn:hover { color: var(--a-color-fg); }

/* ═══════════════════════════════════════════════════════════════════
   方案 2：分栏 Tab 极简型样式
   ═══════════════════════════════════════════════════════════════════ */
.tabbed-flow {
  display: grid;
  gap: 1.5rem;
}
.tabbed-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0.6rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
}
.tabbed-toolbar__tabs {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab-item:hover { color: var(--a-color-fg); }
.tab-item.is-active {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.tab-item__count {
  font-size: 0.68rem;
  color: var(--a-color-muted-soft);
}
.tabbed-toolbar__search {
  position: relative;
  display: flex;
  align-items: center;
}
.tabbed-toolbar__search .search-icon {
  position: absolute;
  left: 0.6rem;
  color: var(--a-color-muted);
}
.tabbed-toolbar__search input {
  padding: 0.35rem 0.75rem 0.35rem 1.8rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  font-size: 0.78rem;
  color: var(--a-color-fg);
  outline: none;
}

.tab-view {
  display: grid;
  gap: 1rem;
}
.tab-sub-filter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.filter-hint {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}
.sub-filter-pill {
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
}
.sub-filter-pill.is-active {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
}

/* 批量订阅广场 */
.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
}
.batch-select-all {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 550;
  color: var(--a-color-fg);
  cursor: pointer;
}
.batch-sub-btn {
  padding: 0.35rem 0.85rem;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-text);
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}
.batch-sub-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.batch-sources-list {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  overflow: hidden;
}
.batch-source-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 6%, transparent);
  background: var(--a-color-bg);
  cursor: pointer;
  transition: background 0.15s ease;
}
.batch-source-row:last-child { border-bottom: none; }
.batch-source-row:hover { background: var(--a-color-surface-muted); }
.batch-source-row.is-selected { background: color-mix(in srgb, var(--a-color-surface-muted) 80%, transparent); }
.batch-source-row__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--feed-source-color) 18%, var(--a-color-bg));
  color: color-mix(in srgb, var(--feed-source-color) 75%, var(--a-color-fg));
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}
.batch-source-row__info {
  min-width: 0;
  flex: 1 1 0;
  display: grid;
  gap: 0.15rem;
}
.batch-source-row__info strong { font-size: 0.88rem; color: var(--a-color-fg); }
.batch-source-row__info small { font-size: 0.74rem; color: var(--a-color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-source-row__subs { font-size: 0.72rem; color: var(--a-color-muted-soft); flex-shrink: 0; }
.batch-status-tag { font-size: 0.7rem; color: #10b981; font-weight: 600; flex-shrink: 0; }

/* ═══════════════════════════════════════════════════════════════════
   方案 3：全景双栏仪表盘样式
   ═══════════════════════════════════════════════════════════════════ */
.dashboard-flow {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
  align-items: start;
  gap: 1.75rem;
}

.dashboard-main {
  display: grid;
  gap: 1rem;
}
.dashboard-main__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 0.5rem;
}
.dashboard-main__head h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
.dashboard-sub-tabs { display: flex; gap: 0.35rem; }
.sub-tab {
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  border: none;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  border-radius: var(--a-radius-control);
}
.sub-tab.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-weight: 600;
}

.dashboard-sidebar {
  display: grid;
  gap: 1.25rem;
}
.sidebar-box {
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  display: grid;
  gap: 0.75rem;
}
.sidebar-box__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sidebar-box__head h3 { font-size: 0.88rem; font-weight: 650; margin: 0; }
.more-link { border: none; background: transparent; color: var(--a-color-muted); font-size: 0.75rem; cursor: pointer; }
.more-link:hover { color: var(--a-color-text); }

.sidebar-channels-list {
  display: grid;
  gap: 0.6rem;
}
.sidebar-channel-card {
  padding: 0.65rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  display: grid;
  gap: 0.35rem;
}
.sidebar-channel-card__top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.sidebar-channel-card__avatar {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--feed-source-color) 18%, var(--a-color-bg));
  color: color-mix(in srgb, var(--feed-source-color) 75%, var(--a-color-fg));
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}
.sidebar-channel-card__text {
  min-width: 0;
  flex: 1 1 0;
  display: grid;
}
.sidebar-channel-card__text h4 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sidebar-channel-card__text small { font-size: 0.68rem; color: var(--a-color-muted-soft); }
.compact-sub-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
}
.compact-sub-btn.is-subscribed {
  color: #10b981;
  border-color: color-mix(in srgb, #10b981 40%, var(--a-color-border-soft));
  background: color-mix(in srgb, #10b981 8%, transparent);
}
.sidebar-channel-card__desc {
  margin: 0;
  font-size: 0.72rem;
  color: var(--a-color-muted);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 标签云 */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.tag-cloud-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  font-size: 0.72rem;
  cursor: pointer;
}
.tag-cloud-item small { color: var(--a-color-muted-soft); }
.tag-cloud-item:hover { border-color: var(--a-color-text); }

/* Promo 盒子 */
.sidebar-box--promo {
  background: var(--a-color-surface-muted);
  border-color: var(--a-color-border);
}
.sidebar-box--promo h4 { margin: 0; font-size: 0.85rem; font-weight: 650; }
.sidebar-box--promo p { margin: 0; font-size: 0.75rem; color: var(--a-color-muted); }
.promo-btn {
  padding: 0.45rem 0.85rem;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-text);
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 960px) {
  .prototype-switch-bar { grid-template-columns: 1fr; }
  .dashboard-flow { grid-template-columns: 1fr; }
  .channels-grid-2col { grid-template-columns: 1fr; }
}
</style>
