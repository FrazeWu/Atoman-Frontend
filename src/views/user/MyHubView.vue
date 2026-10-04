<template>
  <main class="my-hub a-page-xl" aria-labelledby="my-hub-title">
    <header class="my-hub__header">
      <div class="my-hub__identity">
        <PAvatar :src="authStore.user?.avatar_url" :name="displayName" :alt="`${displayName}的头像`" size="lg" />
        <div>
          <p class="my-hub__eyebrow">MY ATOMAN</p>
          <h1 id="my-hub-title">我的 Atoman</h1>
          <p class="my-hub__name">{{ displayName }}</p>
          <p class="my-hub__subtitle">从这里继续阅读、收听、观看和管理你的内容。</p>
        </div>
      </div>
      <div class="my-hub__header-actions">
        <RouterLink class="a-btn a-btn--secondary" :to="profilePath">我的主页</RouterLink>
        <RouterLink class="a-btn a-btn--ghost" :to="settingsPath">账号设置</RouterLink>
      </div>
    </header>

    <section class="my-hub__shortcuts" aria-label="个人入口">
      <RouterLink v-for="item in shortcuts" :key="item.label" :to="item.to" class="my-hub__shortcut">
        <component :is="item.icon" :size="18" aria-hidden="true" />
        <span class="my-hub__shortcut-copy">
          <strong>{{ item.label }}</strong>
          <small>{{ item.description }}</small>
        </span>
        <span v-if="item.badge" class="my-hub__shortcut-badge">{{ item.badge }}</span>
      </RouterLink>
    </section>

    <section class="my-hub__continue" aria-labelledby="my-hub-continue-title">
      <div class="my-hub__section-heading">
        <div>
          <p class="my-hub__eyebrow">CONTINUE</p>
          <h2 id="my-hub-continue-title">继续使用</h2>
        </div>
        <p>从上次离开的地方继续。</p>
      </div>
      <ContentContinueSection module="blog" />
      <ContentContinueSection module="podcast" />
      <ContentContinueSection module="video" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  IconBook2 as BookOpen,
  IconBookmark as Bookmark,
  IconClock as Clock,
  IconHeadphones as Headphones,
  IconMail as Mail,
  IconPencil as Pencil,
  IconPlayerPlay as Play,
} from '@tabler/icons-vue'

import ContentContinueSection from '@/components/content/ContentContinueSection.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'

const authStore = useAuthStore()
const inboxStore = useInboxStore()

const username = computed(() => authStore.user?.username || '')
const displayName = computed(() => authStore.user?.display_name || username.value || '用户')
const profilePath = computed(() => `/users/${username.value}`)
const settingsPath = computed(() => `/users/${username.value}/settings`)

const shortcuts = computed(() => [
  { label: '通知与私信', description: '查看互动和消息', to: '/inbox', icon: Mail, badge: inboxStore.totalUnread > 0 ? String(inboxStore.totalUnread) : '' },
  { label: '创作工作台', description: '管理内容和发布计划', to: '/studio', icon: Pencil, badge: '' },
  { label: '稍后阅读', description: '回到保存的内容', to: '/feed/reading-list', icon: Clock, badge: '' },
  { label: '博客收藏', description: '整理收藏的文章', to: '/posts/bookmarks', icon: Bookmark, badge: '' },
  { label: '音乐收藏', description: '打开音乐资料库', to: '/music/bookmarks', icon: Headphones, badge: '' },
  { label: '音乐历史', description: '继续播放记录', to: '/music/history', icon: Clock, badge: '' },
  { label: '读书书库', description: '查看书目和阅读进度', to: '/books/library', icon: BookOpen, badge: '' },
  { label: '视频收藏', description: '继续观看保存的视频', to: '/videos/favorites', icon: Play, badge: '' },
  { label: '播客收藏', description: '打开收藏的节目', to: '/podcasts/favorites', icon: Headphones, badge: '' },
])
</script>

<style scoped>
.my-hub { padding-bottom: 8rem; }
.my-hub__header { display: flex; justify-content: space-between; gap: 2rem; align-items: center; padding: 1.5rem 0 2rem; border-bottom: 1px solid var(--a-color-border-soft); }
.my-hub__identity { display: flex; min-width: 0; align-items: center; gap: 1rem; }
.my-hub__identity > div { min-width: 0; }
.my-hub__eyebrow { margin: 0 0 0.35rem; color: var(--a-color-muted); font-size: 0.7rem; letter-spacing: 0.08em; }
.my-hub h1, .my-hub h2 { margin: 0; }
.my-hub h1 { font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 600; }
.my-hub__name { margin: 0.2rem 0 0; font-weight: 600; }
.my-hub__subtitle, .my-hub__section-heading > p { margin: 0.4rem 0 0; color: var(--a-color-muted); }
.my-hub__header-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; }
.my-hub__shortcuts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; padding: 1.5rem 0 2rem; }
.my-hub__shortcut { display: flex; min-width: 0; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border: 1px solid var(--a-color-border-soft); color: var(--a-color-fg); text-decoration: none; }
.my-hub__shortcut:hover, .my-hub__shortcut:focus-visible { border-color: var(--a-color-fg); }
.my-hub__shortcut-copy { display: grid; min-width: 0; gap: 0.2rem; }
.my-hub__shortcut-copy strong { font-size: 0.9rem; font-weight: 600; }
.my-hub__shortcut-copy small { overflow: hidden; color: var(--a-color-muted); text-overflow: ellipsis; white-space: nowrap; }
.my-hub__shortcut-badge { display: grid; min-width: 1.35rem; height: 1.35rem; margin-left: auto; place-items: center; border-radius: 999px; background: var(--a-color-fg); color: var(--a-color-bg); font-size: 0.7rem; }
.my-hub__section-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: end; margin-bottom: 0.5rem; }
.my-hub__section-heading > p { margin: 0; }
.my-hub__continue :deep(.continue-section) { margin-bottom: 1rem; }
@media (max-width: 900px) { .my-hub__shortcuts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .my-hub__header, .my-hub__section-heading { align-items: flex-start; flex-direction: column; }
  .my-hub__header-actions { justify-content: flex-start; }
  .my-hub__shortcuts { grid-template-columns: 1fr; }
}
</style>
