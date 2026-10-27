<template>
  <div class="a-page-xl notification-showcase">
    <div class="showcase-header">
      <div class="header-content">
        <span class="header-kicker">DESIGN SHOWCASE</span>
        <h1>通知模块全新“突出块”卡片设计评审</h1>
        <p>基于全屏收件箱架构，参考专辑创建页的突出块容器，强化未读层级、顶栏 Kicker 与内嵌引用槽。</p>
      </div>
      <div class="header-stats">
        <span class="stat-badge stat-unread">4 条未读突出块</span>
        <span class="stat-badge">2 条已读沉底块</span>
      </div>
    </div>

    <div class="showcase-layout">
      <!-- 模拟左侧收件箱导航栏 -->
      <aside class="inbox-nav-pane">
        <div class="nav-section-title">通知分类</div>
        <nav class="nav-list">
          <div
            class="nav-item"
            :class="{ active: activeCategory === 'all' }"
            @click="activeCategory = 'all'"
          >
            <span>全部通知</span>
            <span class="nav-badge">4</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeCategory === 'reply' }"
            @click="activeCategory = 'reply'"
          >
            <span>评论与回复</span>
            <span class="nav-badge">2</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeCategory === 'interaction' }"
            @click="activeCategory = 'interaction'"
          >
            <span>提及与互动</span>
            <span class="nav-badge">1</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeCategory === 'collaboration' }"
            @click="activeCategory = 'collaboration'"
          >
            <span>协作任务</span>
            <span class="nav-badge">1</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeCategory === 'system' }"
            @click="activeCategory = 'system'"
          >
            <span>系统通知</span>
          </div>
        </nav>

        <div class="nav-divider" />

        <div class="nav-section-title">会话沟通</div>
        <nav class="nav-list">
          <div class="nav-item nav-item--dm">
            <div class="nav-dm-label">
              <span class="nav-dm-dot" />
              <span>私信会话</span>
            </div>
            <span class="nav-badge nav-badge--primary">1</span>
          </div>
        </nav>
      </aside>

      <!-- 右侧通知流工作区 -->
      <main class="inbox-main-stream">
        <div class="stream-toolbar">
          <div class="toolbar-left">
            <h2 class="stream-title">全部通知</h2>
            <span class="stream-count-badge">4 未读</span>
          </div>
          <div class="toolbar-right">
            <!-- 未读筛选 -->
            <div class="filter-toggle" role="group" aria-label="未读筛选">
              <button
                class="filter-btn"
                :class="{ active: filterMode === 'all' }"
                @click="filterMode = 'all'"
              >
                全部
              </button>
              <button
                class="filter-btn"
                :class="{ active: filterMode === 'unread' }"
                @click="filterMode = 'unread'"
              >
                仅未读
              </button>
            </div>

            <!-- 一键已读 -->
            <button class="btn-mark-all" title="将当前分类全部通知标为已读">
              <Check :size="14" />
              <span>一键已读</span>
            </button>
          </div>
        </div>

        <div class="cards-container">
          <NotificationItemCard
            v-for="item in filteredNotifications"
            :key="item.id"
            :notification="item"
            :expanded="item.id === 'notif-1'"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check } from 'lucide-vue-next'
import NotificationItemCard from '@/components/notification/NotificationItemCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useDMStore } from '@/stores/dm'
import type { Notification } from '@/types'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const dmStore = useDMStore()

onMounted(() => {
  if (!authStore.isAuthenticated) {
    authStore.user = { id: 1, uuid: 'user-1', username: 'alice', email: 'alice@example.com', role: 'user' }
    authStore.token = 'mock-token'
    authStore.isAuthenticated = true
    notificationStore.unreadCounts.reply = 2
    notificationStore.unreadCounts.like = 1
    notificationStore.unreadCounts.collaboration = 1
    dmStore.dmUnread = 1
  }
})

const activeCategory = ref<'all' | 'reply' | 'interaction' | 'collaboration' | 'system'>('all')
const filterMode = ref<'all' | 'unread'>('all')

const mockNotifications = ref<Notification[]>([
  {
    id: 'notif-1',
    recipient_id: 'user-self',
    actor_id: 'actor-1',
    actor: {
      uuid: 'actor-1',
      username: 'kanye',
      display_name: 'Kanye West',
      avatar_url: '',
      email: 'kanye@example.com',
      role: 'user',
    },
    latest_actor: null,
    type: 'comment_reply',
    category: 'reply',
    reason: '在《Late Registration 编曲分析》中回复了你的长评',
    source_type: 'comment',
    source_id: 'c-100',
    actor_count: 1,
    meta: {
      reply_excerpt: '管弦乐部分的编曲尝试了新的铜管声部混音，与 Hip-hop 鼓点的瞬态碰撞很有张力。',
      original_excerpt: '在这张专辑的第二首曲目中，管弦乐与采样的结合展现了极其独特的空间感。',
      source_label: 'Late Registration 编曲分析',
    },
    read_at: null,
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-2',
    recipient_id: 'user-self',
    actor_id: 'actor-2',
    actor: {
      uuid: 'actor-2',
      username: 'daftpunk',
      display_name: 'Daft Punk',
      avatar_url: '',
      email: 'kanye@example.com',
      role: 'user',
    },
    latest_actor: null,
    type: 'comment_like',
    category: 'like',
    reason: '赞了你的歌曲档案《Random Access Memories》',
    source_type: 'song',
    source_id: 's-200',
    actor_count: 1,
    meta: {
      source_label: 'Random Access Memories',
    },
    read_at: null,
    created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-3',
    recipient_id: 'user-self',
    actor_id: 'actor-3',
    actor: {
      uuid: 'actor-3',
      username: 'editor_jane',
      display_name: 'Jane (协作编辑)',
      avatar_url: '',
      email: 'kanye@example.com',
      role: 'user',
    },
    latest_actor: null,
    type: 'content_published',
    category: 'collaboration',
    reason: '邀请你审核专辑《夏日回声》的完整歌词与演职员名单',
    source_type: 'album',
    source_id: 'alb-300',
    actor_count: 1,
    meta: {
      source_label: '夏日回声 (Summer Echoes)',
      body: '已提交第 3 次演职员修正案，请核对客串制作人信息。',
    },
    read_at: null,
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-4',
    recipient_id: 'user-self',
    actor_id: 'actor-4',
    actor: {
      uuid: 'actor-4',
      username: 'marcus',
      display_name: 'Marcus Miller',
      avatar_url: '',
      email: 'kanye@example.com',
      role: 'user',
    },
    latest_actor: null,
    type: 'comment_mention',
    category: 'mention',
    reason: '在论坛主题《关于黑胶母带翻录标准探讨》中提到了你',
    source_type: 'topic',
    source_id: 't-400',
    actor_count: 1,
    meta: {
      source_label: '黑胶母带翻录标准探讨',
      body: '@你 或许对当年采用的半速刻片工艺有更详细的数据记录。',
    },
    read_at: null,
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-5',
    recipient_id: 'user-self',
    actor_id: 'actor-5',
    actor: null,
    latest_actor: null,
    type: 'site_announcement',
    category: 'system',
    reason: '音乐档案库 v2.4 外部元数据自动关联功能已开放',
    source_type: 'system',
    source_id: 'sys-500',
    actor_count: 1,
    meta: {
      title: '版本更新',
      body: '支持 MusicBrainz / Discogs 智能指纹导入，可在专辑创建流程中体验。',
    },
    read_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-6',
    recipient_id: 'user-self',
    actor_id: 'actor-6',
    actor: {
      uuid: 'actor-6',
      username: 'chopin',
      display_name: 'Frédéric',
      avatar_url: '',
      email: 'kanye@example.com',
      role: 'user',
    },
    latest_actor: null,
    type: 'comment_reply',
    category: 'reply',
    reason: '回复了你在《夜曲 Op.9 No.2 演奏技巧》下的留言',
    source_type: 'comment',
    source_id: 'c-600',
    actor_count: 1,
    meta: {
      reply_excerpt: '触键的力度和踏板的延音控制是关键，不必过分强调重音。',
      source_label: '夜曲 Op.9 No.2 演奏技巧',
    },
    read_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
])

const filteredNotifications = computed(() => {
  let list = mockNotifications.value
  if (activeCategory.value !== 'all') {
    list = list.filter((n) => {
      if (activeCategory.value === 'reply') return n.category === 'reply'
      if (activeCategory.value === 'interaction') return n.category === 'like' || n.category === 'mention'
      if (activeCategory.value === 'collaboration') return n.category === 'collaboration'
      if (activeCategory.value === 'system') return n.category === 'system'
      return true
    })
  }
  if (filterMode.value === 'unread') {
    list = list.filter((n) => !n.read_at)
  }
  return list
})
</script>

<style scoped>
.notification-showcase {
  padding-top: 2rem;
  padding-bottom: 4rem;
  max-width: 82rem;
  margin: 0 auto;
}

.showcase-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.header-kicker {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--a-color-muted);
  text-transform: uppercase;
}

.header-content h1 {
  font-size: 1.65rem;
  font-weight: 650;
  margin: 0.35rem 0 0.5rem;
  color: var(--a-color-fg);
}

.header-content p {
  margin: 0;
  font-size: 0.92rem;
  color: var(--a-color-muted);
}

.header-stats {
  display: flex;
  gap: 0.75rem;
}

.stat-badge {
  font-size: 0.8125rem;
  padding: 0.35rem 0.75rem;
  border-radius: var(--a-radius-card);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
}

.stat-badge.stat-unread {
  background: var(--a-color-surface);
  border-color: var(--a-color-border);
  font-weight: 600;
  color: var(--a-color-text);
  box-shadow: var(--a-shadow-sm);
}

/* 布局 */
.showcase-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-md);
  overflow: hidden;
  min-height: 40rem;
}

/* 导航侧栏 */
.inbox-nav-pane {
  background: var(--a-color-bg);
  border-right: 1px solid var(--a-color-border-soft);
  padding: 1.25rem 0;
  display: flex;
  flex-direction: column;
}

.nav-section-title {
  padding: 0 1.25rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--a-color-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.nav-divider {
  height: 1px;
  background: var(--a-color-border-soft);
  margin: 1rem 1.25rem;
}

.nav-list {
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text-secondary);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: color var(--a-motion-micro) ease, background-color var(--a-motion-micro) ease, border-color var(--a-motion-micro) ease;
}

.nav-item:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}

.nav-item.active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-weight: 600;
  border-left-color: var(--a-color-text);
}

.nav-item--dm {
  color: var(--a-color-text);
}

.nav-dm-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-dm-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--a-color-primary, #2563eb);
}

.nav-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: var(--a-radius-control);
  background: var(--a-color-text);
  color: var(--a-color-bg);
}

.nav-badge--primary {
  background: var(--a-color-primary, #2563eb);
  color: #ffffff;
}

/* 主流区 */
.inbox-main-stream {
  display: flex;
  flex-direction: column;
}

.stream-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.75rem;
  min-height: 3.5rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.stream-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--a-color-fg);
}

.stream-count-badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--a-color-primary) 12%, transparent);
  color: var(--a-color-primary);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.filter-toggle {
  display: inline-flex;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  padding: 2px;
  background: var(--a-color-bg);
}

.filter-btn {
  padding: 0.25rem 0.75rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
  cursor: pointer;
  border-radius: var(--a-radius-control);
  transition: color var(--a-motion-micro) ease, background-color var(--a-motion-micro) ease, border-color var(--a-motion-micro) ease;
}

.filter-btn:hover {
  color: var(--a-color-text);
}

.filter-btn.active {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-weight: 600;
}

.btn-mark-all {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text-secondary);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  transition: color var(--a-motion-micro) ease, background-color var(--a-motion-micro) ease, border-color var(--a-motion-micro) ease;
}

.btn-mark-all:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  border-color: var(--a-color-border);
}

.cards-container {
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  max-width: 820px;
}
</style>