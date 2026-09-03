<template>
  <div class="discover-preview-root">
    <!-- 顶部全局方案切换器 -->
    <header class="discover-preview-header">
      <div class="discover-preview-header__main">
        <h1>发现页与博客/短笺卡片全新设计方案评审</h1>
        <p>点击下方按钮直接切换体验 3 种发现页架构原型与 6 款博客/短笺卡片新设计：</p>
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
            <PContentCard
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
            </PContentCard>
          </div>
        </section>

        <!-- 右侧信息流：💡 优质频道与源推荐流 -->
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
              v-for="channel in mockChannels"
              :key="channel.id"
              class="feed-source-card feed-source-card--rich"
            >
              <div class="feed-source-card__header">
                <div class="feed-source-card__avatar" :style="{ '--feed-source-color': channel.color }">
                  {{ channel.avatarLabel }}
                </div>
                <div class="feed-source-card__info">
                  <div class="feed-source-card__title-row">
                    <h3 class="feed-source-card__title">{{ channel.title }}</h3>
                    <span class="feed-source-card__tag">{{ channel.category }}</span>
                  </div>
                  <p class="feed-source-card__summary">{{ channel.description }}</p>
                </div>
                <button
                  type="button"
                  class="feed-source-card__sub-btn"
                  :class="{ 'is-subscribed': channel.subscribed }"
                  @click.stop="channel.subscribed = !channel.subscribed"
                >
                  <Check v-if="channel.subscribed" :size="13" />
                  <Plus v-else :size="13" />
                  <span>{{ channel.subscribed ? '已订阅' : '订阅' }}</span>
                </button>
              </div>

              <ul class="feed-source-card__previews">
                <li v-for="recent in channel.recentArticles" :key="recent.id">
                  <span class="preview-bullet">›</span>
                  <span class="preview-title">{{ recent.title }}</span>
                </li>
              </ul>

              <div class="feed-source-card__footer">
                <span class="footer-stat"><Users :size="12" />{{ channel.subscribers }} 订阅</span>
                <span class="footer-stat"><FileText :size="12" />{{ channel.recentCount }} 近期</span>
                <span class="footer-time">{{ channel.updatedAt }}</span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>

    <!-- ═══════════════════════════════════════════════════════════════
         方案 4：博客模块卡片全新设计方案评审（Blog & Short Note Cards）
         ═══════════════════════════════════════════════════════════════ -->
    <main v-else-if="activeProto === 'blog_and_notes'" class="discover-layout blog-design-review">
      <!-- ─────────────────────────────────────────────────────────────
           Part 1: 博客文章卡片设计方案对比 (Blog Post Cards)
           ───────────────────────────────────────────────────────────── -->
      <section class="review-section">
        <div class="review-section__head">
          <div class="review-badge">PART 1</div>
          <h2>博客文章卡片 · 3 种设计方案对比</h2>
          <p>用于博客首页、专栏频道页、个人主页等长文信息流展示。</p>
        </div>

        <div class="cards-showcase-grid">
          <!-- 博客方案 1：极简流式行（对齐 PContentCard 淡绿竖线，高信息密度 · 推荐） -->
          <div class="card-showcase-col">
            <div class="col-badge col-badge--recommended">方案 1 · 极简流式行（推荐）</div>
            <p class="col-desc">左侧淡绿竖线未读指示，单行集中 meta，高度极紧凑，视觉节奏与 Feed 保持高度一致。</p>

            <div class="showcase-box">
              <div class="demo-status-toggle">
                <span>预览状态：</span>
                <button
                  class="pill-btn"
                  :class="{ 'is-active': blogCard1Unread }"
                  @click="blogCard1Unread = !blogCard1Unread"
                >
                  {{ blogCard1Unread ? '🟢 当前未读 (带绿线)' : '⚪ 当前已读 (左侧透明)' }}
                </button>
              </div>

              <div class="feed-timeline-box" style="margin-top: 0.75rem;">
                <PContentCard
                  title="深入理解 SwiftUI 状态驱动架构与单向数据流"
                  summary="在复杂的客户端应用中，如何通过声明式状态容器和单一可信数据源（Single Source of Truth）保证 UI 与业务逻辑的强一致性？本文深入拆解状态流转链路与渲染优化策略。"
                  :is-read="!blogCard1Unread"
                  class="content-stream-entry"
                >
                  <template #meta>
                    <span class="a-label feed-source-link">张三</span>
                    <span class="a-label a-muted">《iOS 进阶专栏》</span>
                    <span class="feed-meta-stat"><Eye :size="11" />3.4K</span>
                    <span class="feed-meta-stat"><Gauge :size="11" />4.9 (18)</span>
                    <span class="feed-meta-stat"><Bookmark :size="11" />256</span>
                    <span style="color:var(--a-color-muted-soft)">6月20日</span>
                    <span class="feed-type-tag feed-type-tag--blog">博客</span>
                  </template>
                  <template #actions>
                    <button class="mock-clip-btn" title="收藏"><Bookmark :size="14" /></button>
                    <button class="mock-clip-btn" title="稍后阅读"><Clock :size="14" /></button>
                  </template>
                </PContentCard>
              </div>
            </div>
          </div>

          <!-- 博客方案 2：现代微杂志卡片（图文并茂，88px 封面 + 药丸指标气泡） -->
          <div class="card-showcase-col">
            <div class="col-badge">方案 2 · 现代微杂志卡片</div>
            <p class="col-desc">右侧配有精致 88×64px 封面缩略图，底部采用药丸状微型指标气泡，视觉丰富度更强。</p>

            <div class="showcase-box">
              <article class="magazine-blog-card">
                <div class="magazine-blog-card__main">
                  <div class="magazine-blog-card__header">
                    <span class="mag-author">李四 ✦</span>
                    <span class="mag-dot">·</span>
                    <span class="mag-channel">《全栈系统设计》</span>
                    <span class="mag-dot">·</span>
                    <span class="mag-date">2天前</span>
                  </div>
                  <h3 class="magazine-blog-card__title">从零构建分布式高可用缓存引擎</h3>
                  <p class="magazine-blog-card__summary">基于 Go + Raft 算法实现分布式一致性协议，拆解内存分片与淘汰策略...</p>
                  <div class="magazine-blog-card__footer">
                    <span class="mag-pill"><Eye :size="11" /> 2.8K 阅读</span>
                    <span class="mag-pill"><Gauge :size="11" /> 4.8 评分</span>
                    <span class="mag-pill"><Bookmark :size="11" /> 182 收藏</span>
                  </div>
                </div>
                <div class="magazine-blog-card__cover">
                  <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=200&auto=format&fit=crop&q=80" alt="封面" />
                </div>
              </article>
            </div>
          </div>

          <!-- 博客方案 3：专栏结构化卡片（专栏头部 Banner + 大标题 + 标签组） -->
          <div class="card-showcase-col">
            <div class="col-badge">方案 3 · 专栏结构化卡片</div>
            <p class="col-desc">顶部专栏归属横幅，突出所属专栏与期数，正文带 Tag 标签组与快捷阅读按钮。</p>

            <div class="showcase-box">
              <article class="structured-blog-card">
                <div class="structured-blog-card__top">
                  <span class="struct-channel-badge">专栏 · 《现代前端工程化》第 14 期</span>
                  <span class="struct-time">06-18</span>
                </div>
                <h3 class="structured-blog-card__title">Vite 6 与现代打包器底层性能优化实战</h3>
                <p class="structured-blog-card__summary">深入 Rolldown 与 Turbopack 架构，探索 ESM 热重载性能极限与微模块缓存机制。</p>
                <div class="structured-blog-card__tags">
                  <span class="struct-tag">#Vite</span>
                  <span class="struct-tag">#Rust</span>
                  <span class="struct-tag">#前端性能</span>
                </div>
                <div class="structured-blog-card__footer">
                  <div class="struct-meta">
                    <span>王五</span>
                    <span>·</span>
                    <span>4.2K 阅读</span>
                  </div>
                  <span class="struct-read-link">阅读正文 →</span>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <!-- ─────────────────────────────────────────────────────────────
           Part 2: 短笺卡片设计方案对比 (Short Note Cards)
           ───────────────────────────────────────────────────────────── -->
      <section class="review-section" style="margin-top: 2.5rem;">
        <div class="review-section__head">
          <div class="review-badge review-badge--note">PART 2</div>
          <h2>短笺卡片 · 3 种设计方案对比</h2>
          <p>用于即时想法、碎片灵感、多图动态发布与行内轻量讨论。</p>
        </div>

        <div class="cards-showcase-grid">
          <!-- 短笺方案 A：现代精致便签（32px 头像 + 短文 + 2图 + 胶囊互动栏 + 内嵌评论 · 推荐） -->
          <div class="card-showcase-col">
            <div class="col-badge col-badge--recommended">方案 A · 现代精致便签（推荐）</div>
            <p class="col-desc">32px 头像 + 舒适行高 + 自适应多图网格 + 胶囊互动栏，支持点击“讨论”在卡片底部丝滑内嵌展开评论。</p>

            <div class="showcase-box">
              <article class="modern-note-card">
                <!-- 头部 -->
                <header class="modern-note-card__header">
                  <div class="note-author-avatar">张</div>
                  <div class="note-author-info">
                    <div class="note-author-row">
                      <strong class="note-name">张三</strong>
                      <span class="note-badge">短笺</span>
                    </div>
                    <span class="note-time">10分钟前 · 已编辑</span>
                  </div>
                  <div class="note-owner-actions">
                    <button class="note-icon-btn" title="编辑"><Pencil :size="13" /></button>
                    <button class="note-icon-btn is-danger" title="删除"><Trash2 :size="13" /></button>
                  </div>
                </header>

                <!-- 正文内容 -->
                <div class="modern-note-card__body">
                  <p class="note-text">
                    今天把左右双并列信息流落地了！左边看热门精选好文，右边选优质作者和独立博客，大屏下的阅读沉浸感和信息密度确实舒服很多。💡
                  </p>
                  <!-- 2 图并列预览 -->
                  <div class="note-media-grid count-2">
                    <div class="note-media-thumb">
                      <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80" alt="图片1" />
                    </div>
                    <div class="note-media-thumb">
                      <img src="https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=300&auto=format&fit=crop&q=80" alt="图片2" />
                    </div>
                  </div>
                </div>

                <!-- 胶囊互动操作栏 -->
                <footer class="modern-note-card__footer">
                  <button
                    type="button"
                    class="note-pill-action"
                    :class="{ 'is-liked': noteALiked }"
                    @click="noteALiked = !noteALiked"
                  >
                    <Heart :size="13" :fill="noteALiked ? 'currentColor' : 'none'" />
                    <span>{{ noteALiked ? '43' : '42' }}</span>
                  </button>

                  <button
                    type="button"
                    class="note-pill-action"
                    :class="{ 'is-active': noteACommentsOpen }"
                    @click="noteACommentsOpen = !noteACommentsOpen"
                  >
                    <MessageSquare :size="13" />
                    <span>8 条讨论</span>
                  </button>

                  <button type="button" class="note-pill-action">
                    <Share2 :size="13" />
                    <span>分享</span>
                  </button>
                </footer>

                <!-- 内嵌平滑评论区预览 -->
                <div v-if="noteACommentsOpen" class="note-inline-comments">
                  <div class="inline-comment-head">共 8 条讨论</div>
                  <div class="mock-comment-item">
                    <span class="commenter">李四:</span>
                    <span class="comment-content">双流排版确实比之前切来切去顺畅很多，点赞！👍</span>
                  </div>
                  <div class="mock-comment-input">
                    <input type="text" placeholder="写下你的想法与讨论..." />
                    <button type="button">发送</button>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <!-- 短笺方案 B：极简彩色便签条（彩色左边缘 + 紧凑文字 + 极简互动） -->
          <div class="card-showcase-col">
            <div class="col-badge">方案 B · 极简彩色便签条</div>
            <p class="col-desc">左侧黄色便签指示线，紧凑单行作者头，突出即时文字灵感与快速备忘录属性。</p>

            <div class="showcase-box">
              <article class="sticky-memo-card">
                <div class="sticky-memo-head">
                  <span class="sticky-author">张三</span>
                  <span class="sticky-dot">·</span>
                  <span class="sticky-time">2小时前</span>
                </div>
                <p class="sticky-content">
                  “重构的真正目的不是为了把代码变漂亮，而是为了让未来的每一次变化都变得安全且容易。”—— 今天的随手摘录。
                </p>
                <div class="sticky-footer">
                  <span class="sticky-stat">❤️ 19 赞</span>
                  <span class="sticky-stat">💬 3 讨论</span>
                </div>
              </article>
            </div>
          </div>

          <!-- 短笺方案 C：分栏气泡灵感卡（左侧头像列 + 右侧圆角气泡内容） -->
          <div class="card-showcase-col">
            <div class="col-badge">方案 C · 分栏气泡灵感卡</div>
            <p class="col-desc">类似 GitHub Discussion 的经典分栏：左侧头像独立成列，右侧为带圆角的气泡正文容器。</p>

            <div class="showcase-box">
              <div class="bubble-note-layout">
                <div class="bubble-avatar">张</div>
                <div class="bubble-container">
                  <div class="bubble-head">
                    <strong>张三</strong>
                    <span class="bubble-time">昨天 18:30</span>
                  </div>
                  <p class="bubble-text">
                    尝试给卡片增加了微光高亮和 hover 浮层，大家觉得哪种动效体验更自然？
                  </p>
                  <div class="bubble-actions">
                    <button class="bubble-btn">❤️ 12</button>
                    <button class="bubble-btn">💬 5</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ═══════════════════════════════════════════════════════════════
         方案 2 & 方案 3 备用原形保持可用
         ═══════════════════════════════════════════════════════════════ -->
    <main v-else-if="activeProto === 'tabbed'" class="discover-layout tabbed-flow">
      <!-- 方案 2 结构 -->
      <div class="tabbed-top-bar">
        <div class="tabbed-nav">
          <button class="tab-btn is-active">💡 优质频道推荐</button>
          <button class="tab-btn">🔥 热门精选文章</button>
        </div>
      </div>
      <p style="padding: 2rem; text-align: center; color: var(--a-color-muted);">方案 2 Tab 极简型原型（已备用）</p>
    </main>

    <main v-else-if="activeProto === 'dashboard'" class="discover-layout dashboard-flow">
      <p style="padding: 2rem; text-align: center; color: var(--a-color-muted);">方案 3 全景双栏原型（已备用）</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconBookmark as Bookmark, IconCheck as Check, IconClock as Clock, IconEye as Eye, IconFileText as FileText, IconGauge as Gauge, IconHeart as Heart, IconMessage as MessageSquare, IconPencil as Pencil, IconPlus as Plus, IconSearch as Search, IconShare2 as Share2, IconTrash as Trash2, IconUsers as Users } from '@tabler/icons-vue'
import PContentCard from '@/components/ui/PContentCard.vue'

// ── 方案定义 ──
const prototypeOptions = [
  {
    id: 'blog_and_notes' as const,
    icon: '📝',
    name: '博客与短笺卡片设计评审',
    tag: '全新重点 · 6 款卡片对比',
    summary: '博客长文卡片 (3款) + 短笺灵感卡片 (3款)',
    details: '包含博客文章的“极简流式行”、“现代微杂志卡”、“专栏结构卡”，以及短笺的“精致便签”、“极简彩色条”、“分栏气泡卡”。',
  },
  {
    id: 'curated' as const,
    icon: '✨',
    name: '发现页方案 1：双并列信息流',
    tag: '已上线发现页',
    summary: '左侧精选文章 + 右侧推荐频道并列',
    details: '全宽双并列流式架构，顶部搜索与主题胶囊联动，左栏淡绿竖线文章，右栏方案 B 频道卡片。',
  },
]

const activeProto = ref<'blog_and_notes' | 'curated' | 'tabbed' | 'dashboard'>('blog_and_notes')

const currentProtoMeta = computed(() => {
  return prototypeOptions.find(p => p.id === activeProto.value) || prototypeOptions[0]
})

// ── 博客与短笺设计评审交互状态 ──
const blogCard1Unread = ref(true)
const noteALiked = ref(false)
const noteACommentsOpen = ref(false)

// ── 发现页双流预览模拟数据 ──
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

const mockArticles = ref([
  {
    id: 'art-1',
    title: '深入理解 SwiftUI 状态驱动架构与单向数据流',
    summary: '在复杂的客户端应用中，如何通过声明式状态容器和单一可信数据源（Single Source of Truth）保证 UI 与业务逻辑的强一致性？',
    source: '张三 · 个人专栏',
    views: '3.4K',
    rating: '4.9',
    bookmarks: 256,
    date: '6月20日',
    badge: '博客',
    badgeType: 'blog',
    isRead: false,
  },
  {
    id: 'art-2',
    title: 'Claude 3.7 Sonnet 混合推理机制深度实测与工程实践',
    summary: '实测动态思考 token 与标准输出在代码生成和数学推理中的延迟与表现差异，如何在生产中控制上下文窗口与成本。',
    source: 'AI 探索周刊',
    views: '5.8K',
    rating: '5.0',
    bookmarks: 412,
    date: '6月19日',
    badge: '新闻',
    badgeType: 'rss',
    isRead: true,
  },
])

const mockChannels = ref([
  {
    id: 'chan-1',
    title: '少数派 sspai',
    category: 'TECH & LIFESTYLE',
    description: '高效工作与品质生活，关注工具、数字生活与深度应用技巧。',
    avatarLabel: '少',
    color: '#da5635',
    subscribers: '12.8K',
    recentCount: 8,
    updatedAt: '今天更新',
    subscribed: false,
    recentArticles: [
      { id: 'r1', title: 'OpenAI o3 之后，agent 设计空间怎么变了' },
      { id: 'r2', title: 'Claude Code 工作流拆解与生产体验' },
    ],
  },
  {
    id: 'chan-2',
    title: 'Next Architecture',
    category: 'ENGINEERING',
    description: '深入分布式系统、存储引擎与云原生现代架构演进。',
    avatarLabel: 'N',
    color: '#2563eb',
    subscribers: '6.4K',
    recentCount: 4,
    updatedAt: '昨天更新',
    subscribed: true,
    recentArticles: [
      { id: 'r3', title: '为什么越来越多现代团队重写检索层' },
      { id: 'r4', title: '单机百万连接长轮询性能调优指南' },
    ],
  },
])
</script>

<style scoped>
.discover-preview-root {
  max-width: 82rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 6rem;
  display: grid;
  gap: 1.75rem;
}

/* 顶部评审切换器 */
.discover-preview-header {
  display: grid;
  gap: 1rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}
.discover-preview-header__main h1 {
  font-size: 1.5rem;
  font-weight: 750;
  margin: 0 0 0.35rem;
  color: var(--a-color-fg);
}
.discover-preview-header__main p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--a-color-muted);
}

.prototype-switch-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
}
.proto-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  cursor: pointer;
  text-align: left;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}
.proto-btn:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}
.proto-btn.is-active {
  border-color: var(--a-color-text);
  background: var(--a-color-surface-muted);
  box-shadow: 0 0 0 1px var(--a-color-text);
}
.proto-btn__icon { font-size: 1.25rem; }
.proto-btn__name { font-size: 0.95rem; font-weight: 700; color: var(--a-color-fg); }
.proto-btn__tag { font-size: 0.72rem; color: var(--a-color-muted); }

.proto-desc-box {
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  padding: 0.75rem 1rem;
  font-size: 0.82rem;
  line-height: 1.5;
}
.proto-desc-box strong { color: var(--a-color-fg); display: block; margin-bottom: 0.2rem; }
.proto-desc-box p { margin: 0; color: var(--a-color-muted); }

/* ═══════════════════════════════════════════════════════════════
   博客 & 短笺设计评审专属样式
   ═══════════════════════════════════════════════════════════════ */
.blog-design-review {
  display: grid;
  gap: 2rem;
}

.review-section {
  display: grid;
  gap: 1.25rem;
}
.review-section__head {
  display: grid;
  gap: 0.35rem;
}
.review-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.15em 0.55em;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, #2563eb 15%, transparent);
  color: #2563eb;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.review-badge--note {
  background: color-mix(in srgb, #9333ea 15%, transparent);
  color: #9333ea;
}
.review-section__head h2 {
  font-size: 1.25rem;
  font-weight: 750;
  margin: 0;
  color: var(--a-color-fg);
}
.review-section__head p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--a-color-muted);
}

.cards-showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
  align-items: start;
}

.card-showcase-col {
  display: grid;
  gap: 0.6rem;
}
.col-badge {
  display: inline-flex;
  align-self: flex-start;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--a-color-fg);
}
.col-badge--recommended {
  color: #10b981;
}
.col-desc {
  margin: 0;
  font-size: 0.76rem;
  color: var(--a-color-muted);
  line-height: 1.4;
  min-height: 2.1rem;
}

.showcase-box {
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-card);
  padding: 0.85rem;
}

.demo-status-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--a-color-muted);
}
.pill-btn {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--a-color-border);
  background: var(--a-color-bg);
  font-size: 0.72rem;
  cursor: pointer;
  color: var(--a-color-fg);
}

/* 博客方案 2：现代微杂志卡片 */
.magazine-blog-card {
  display: flex;
  align-items: stretch;
  gap: 0.85rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  padding: 0.85rem;
  transition: border-color 0.18s ease;
}
.magazine-blog-card:hover { border-color: var(--a-color-border); }
.magazine-blog-card__main { flex: 1 1 auto; min-width: 0; display: grid; gap: 0.35rem; }
.magazine-blog-card__header { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--a-color-muted); }
.mag-author { font-weight: 600; color: var(--a-color-fg); }
.magazine-blog-card__title { font-size: 0.92rem; font-weight: 700; color: var(--a-color-fg); margin: 0; line-height: 1.35; }
.magazine-blog-card__summary { font-size: 0.76rem; color: var(--a-color-muted); margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.magazine-blog-card__footer { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.2rem; }
.mag-pill { display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.15em 0.45em; border-radius: var(--a-radius-control); background: var(--a-color-surface-muted); color: var(--a-color-muted); font-size: 0.68rem; font-weight: 500; }
.magazine-blog-card__cover { width: 84px; height: 72px; flex-shrink: 0; border-radius: var(--a-radius-control); overflow: hidden; background: var(--a-color-surface-muted); }
.magazine-blog-card__cover img { width: 100%; height: 100%; object-fit: cover; }

/* 博客方案 3：专栏结构化卡片 */
.structured-blog-card {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  padding: 0.85rem;
  display: grid;
  gap: 0.45rem;
}
.structured-blog-card__top { display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; }
.struct-channel-badge { font-weight: 600; color: #2563eb; background: color-mix(in srgb, #2563eb 10%, transparent); padding: 0.15em 0.5em; border-radius: var(--a-radius-control); }
.struct-time { color: var(--a-color-muted-soft); }
.structured-blog-card__title { font-size: 0.95rem; font-weight: 750; margin: 0; color: var(--a-color-fg); }
.structured-blog-card__summary { font-size: 0.76rem; color: var(--a-color-muted); margin: 0; line-height: 1.4; }
.structured-blog-card__tags { display: flex; gap: 0.35rem; }
.struct-tag { font-size: 0.68rem; color: var(--a-color-muted); background: var(--a-color-surface-muted); padding: 0.1em 0.4em; border-radius: 4px; }
.structured-blog-card__footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--a-color-border-soft); padding-top: 0.5rem; font-size: 0.72rem; }
.struct-meta { color: var(--a-color-muted); display: flex; gap: 0.3rem; }
.struct-read-link { font-weight: 600; color: var(--a-color-text); }

/* 短笺方案 A：现代精致便签 */
.modern-note-card {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.modern-note-card__header { display: flex; align-items: center; gap: 0.6rem; }
.note-author-avatar { width: 32px; height: 32px; border-radius: 999px; background: #8b5cf6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
.note-author-info { display: grid; gap: 0.1rem; flex: 1 1 auto; }
.note-author-row { display: flex; align-items: center; gap: 0.4rem; }
.note-name { font-size: 0.85rem; color: var(--a-color-fg); }
.note-badge { font-size: 0.62rem; font-weight: 700; padding: 0.1em 0.4em; border-radius: 999px; background: color-mix(in srgb, #9333ea 12%, transparent); color: #9333ea; }
.note-time { font-size: 0.7rem; color: var(--a-color-muted-soft); }
.note-owner-actions { display: flex; gap: 0.3rem; }
.note-icon-btn { border: none; background: transparent; padding: 0.25rem; border-radius: var(--a-radius-control); color: var(--a-color-muted); cursor: pointer; }
.note-icon-btn:hover { background: var(--a-color-surface-muted); color: var(--a-color-fg); }
.note-icon-btn.is-danger:hover { color: var(--a-color-danger); }

.modern-note-card__body { display: grid; gap: 0.6rem; }
.note-text { margin: 0; font-size: 0.86rem; line-height: 1.6; color: var(--a-color-fg); }
.note-media-grid { display: grid; gap: 0.45rem; }
.note-media-grid.count-2 { grid-template-columns: 1fr 1fr; }
.note-media-thumb { height: 110px; border-radius: var(--a-radius-control); overflow: hidden; background: var(--a-color-surface-muted); }
.note-media-thumb img { width: 100%; height: 100%; object-fit: cover; }

.modern-note-card__footer { display: flex; align-items: center; gap: 0.5rem; padding-top: 0.4rem; border-top: 1px solid var(--a-color-border-soft); }
.note-pill-action { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.65rem; border-radius: 999px; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); font-size: 0.72rem; color: var(--a-color-muted); cursor: pointer; transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
.note-pill-action:hover { border-color: var(--a-color-border); color: var(--a-color-fg); background: var(--a-color-surface-muted); }
.note-pill-action.is-liked { border-color: #ef4444; color: #ef4444; background: color-mix(in srgb, #ef4444 8%, transparent); }
.note-pill-action.is-active { border-color: var(--a-color-text); color: var(--a-color-fg); background: var(--a-color-surface-muted); }

/* 行内评论折叠区 */
.note-inline-comments { background: var(--a-color-surface-muted); border-radius: var(--a-radius-control); padding: 0.65rem; display: grid; gap: 0.45rem; font-size: 0.75rem; }
.inline-comment-head { font-size: 0.7rem; font-weight: 700; color: var(--a-color-muted); }
.mock-comment-item { display: flex; gap: 0.3rem; color: var(--a-color-fg); }
.commenter { font-weight: 600; color: var(--a-color-text); flex-shrink: 0; }
.mock-comment-input { display: flex; gap: 0.4rem; margin-top: 0.2rem; }
.mock-comment-input input { flex: 1 1 auto; padding: 0.25rem 0.5rem; font-size: 0.72rem; border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: inherit; }
.mock-comment-input button { padding: 0.25rem 0.6rem; font-size: 0.72rem; border-radius: var(--a-radius-control); border: 1px solid var(--a-color-text); background: var(--a-color-text); color: var(--a-color-bg); cursor: pointer; }

/* 短笺方案 B：极简便签条 */
.sticky-memo-card {
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-left: 4px solid #f59e0b;
  border-radius: var(--a-radius-control);
  padding: 0.85rem;
  display: grid;
  gap: 0.45rem;
}
.sticky-memo-head { font-size: 0.72rem; color: var(--a-color-muted); }
.sticky-author { font-weight: 600; color: var(--a-color-fg); }
.sticky-content { margin: 0; font-size: 0.82rem; line-height: 1.5; color: var(--a-color-fg); font-style: italic; }
.sticky-footer { display: flex; gap: 0.75rem; font-size: 0.7rem; color: var(--a-color-muted-soft); padding-top: 0.2rem; }

/* 短笺方案 C：分栏气泡灵感卡 */
.bubble-note-layout { display: flex; gap: 0.65rem; }
.bubble-avatar { width: 30px; height: 30px; border-radius: 999px; background: #06b6d4; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; }
.bubble-container { flex: 1 1 auto; background: var(--a-color-bg); border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); padding: 0.75rem; display: grid; gap: 0.4rem; }
.bubble-head { display: flex; justify-content: space-between; font-size: 0.74rem; }
.bubble-time { color: var(--a-color-muted-soft); }
.bubble-text { margin: 0; font-size: 0.82rem; line-height: 1.5; color: var(--a-color-fg); }
.bubble-actions { display: flex; gap: 0.5rem; }
.bubble-btn { border: none; background: transparent; padding: 0.15rem 0.35rem; font-size: 0.7rem; color: var(--a-color-muted); cursor: pointer; }

/* ═══════════════════════════════════════════════════════════════
   方案 1 双并列流通用样式
   ═══════════════════════════════════════════════════════════════ */
.dual-stream-flow { display: grid; gap: 1.5rem; }
.dual-stream-head { display: grid; gap: 0.75rem; }
.curated-search { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 0.85rem; border: 1px solid var(--a-color-border); border-radius: var(--a-radius-control); background: var(--a-color-bg); }
.curated-search input { flex: 1 1 auto; border: none; background: transparent; font-size: 0.85rem; color: inherit; outline: none; }
.curated-topics { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.topic-pill { padding: 0.3rem 0.75rem; border-radius: 999px; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); font-size: 0.76rem; font-weight: 550; color: var(--a-color-muted); cursor: pointer; }
.topic-pill.is-active { background: var(--a-color-text); color: var(--a-color-bg); border-color: var(--a-color-text); }

.dual-streams-container { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.stream-column { display: grid; gap: 0.85rem; min-width: 0; }
.stream-column__head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--a-color-border-soft); padding-bottom: 0.45rem; }
.stream-column__title-group { display: flex; align-items: center; gap: 0.5rem; }
.stream-column__title-group h2 { font-size: 1.05rem; font-weight: 700; margin: 0; }
.stream-count { font-size: 0.72rem; color: var(--a-color-muted-soft); }
.section-badge { font-size: 0.62rem; font-weight: 800; padding: 0.15em 0.45em; border-radius: var(--a-radius-control); background: var(--a-color-surface-muted); }
.section-badge--hot { background: color-mix(in srgb, #ea580c 15%, transparent); color: #ea580c; }
.stream-sub-filters { display: flex; gap: 0.3rem; }
.mini-filter { padding: 0.2rem 0.55rem; font-size: 0.72rem; border: 1px solid transparent; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-muted); cursor: pointer; }
.mini-filter.is-active { background: var(--a-color-surface-muted); color: var(--a-color-fg); font-weight: 600; border-color: var(--a-color-border-soft); }

.feed-timeline-box { border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); overflow: hidden; background: var(--a-color-bg); }
.feed-meta-stat { display: inline-flex; align-items: center; gap: 0.2rem; color: var(--a-color-muted-soft); font-size: 0.72rem; }
.feed-type-tag { display: inline-flex; padding: 0.1em 0.45em; border-radius: 999px; font-size: 0.65rem; font-weight: 600; }
.feed-type-tag--blog { background: color-mix(in srgb, #16a34a 12%, transparent); color: #16a34a; }
.feed-type-tag--rss { background: color-mix(in srgb, #2563eb 12%, transparent); color: #2563eb; }
.mock-clip-btn { border: none; background: transparent; padding: 0.2rem; color: var(--a-color-muted); cursor: pointer; }

/* 频道卡片样式 */
.channels-stack { display: grid; gap: 0.75rem; }
.feed-source-card { display: flex; flex-direction: column; gap: 0.65rem; padding: 0.85rem 0.95rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); }
.feed-source-card__header { display: flex; align-items: flex-start; gap: 0.75rem; }
.feed-source-card__avatar { width: 40px; height: 40px; border-radius: var(--a-radius-control); background: var(--feed-source-color, var(--a-color-surface-muted)); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.05rem; flex-shrink: 0; }
.feed-source-card__info { flex: 1 1 auto; min-width: 0; display: grid; gap: 0.2rem; }
.feed-source-card__title-row { display: flex; align-items: center; gap: 0.45rem; }
.feed-source-card__title { font-size: 0.92rem; font-weight: 700; margin: 0; }
.feed-source-card__tag { font-size: 0.62rem; font-weight: 700; color: var(--a-color-muted); background: var(--a-color-surface-muted); padding: 0.1em 0.4em; border-radius: 4px; }
.feed-source-card__summary { margin: 0; font-size: 0.78rem; color: var(--a-color-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.feed-source-card__sub-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.35rem 0.75rem; border-radius: var(--a-radius-control); border: 1px solid var(--a-color-text); background: var(--a-color-text); color: var(--a-color-bg); font-size: 0.75rem; font-weight: 600; cursor: pointer; flex-shrink: 0; }
.feed-source-card__sub-btn.is-subscribed { border-color: var(--a-color-border); background: var(--a-color-surface-muted); color: var(--a-color-muted); }
.feed-source-card__previews { margin: 0; padding: 0.45rem 0.65rem; list-style: none; display: grid; gap: 0.25rem; background: var(--a-color-surface-muted); border-radius: var(--a-radius-control); font-size: 0.74rem; }
.feed-source-card__previews li { display: flex; align-items: center; gap: 0.35rem; color: var(--a-color-fg); }
.preview-bullet { color: var(--a-color-muted-soft); font-weight: 700; }
.feed-source-card__footer { display: flex; align-items: center; gap: 0.75rem; font-size: 0.7rem; color: var(--a-color-muted-soft); }
.footer-stat { display: inline-flex; align-items: center; gap: 0.25rem; }
.footer-time { margin-left: auto; }

@media (max-width: 880px) {
  .cards-showcase-grid { grid-template-columns: 1fr; }
  .dual-streams-container { grid-template-columns: 1fr; }
}
</style>
