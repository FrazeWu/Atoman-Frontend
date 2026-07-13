<template>
  <PSidebar>
    <!-- 1. FEED MODULE SIDEBAR -->
    <template v-if="currentModule === 'feed'">
      <PSidebarItem
        v-for="(item, index) in feedNavItems"
        :key="item.to"
        :to="item.to"
        :index="index + 1"
        :icon="item.icon"
        :is-focused="uiStore && uiStore.focusedSection === 'sidebar' && focusedSidebarIndex === index"
        :exact="item.exact"
      >
        {{ item.label }}
      </PSidebarItem>
    </template>

    <!-- 2. BLOG MODULE SIDEBAR -->
    <template v-else-if="currentModule === 'blog'">
      <PSidebarItem
        v-for="(item, index) in blogNavItems"
        :key="item.to"
        :to="item.to"
        :index="index + 1"
        :icon="item.icon"
        :exact="item.exact"
      >
        {{ item.label }}
      </PSidebarItem>
    </template>

    <!-- 3. MUSIC MODULE SIDEBAR -->
    <template v-else-if="currentModule === 'music'">
      <PSidebarItem
        v-for="(item, index) in musicNavItems"
        :key="item.to"
        :to="item.to"
        :index="index + 1"
        :icon="item.icon"
        :exact="item.exact"
      >
        {{ item.label }}
      </PSidebarItem>
    </template>

    <!-- 4. FORUM MODULE SIDEBAR -->
    <template v-else-if="currentModule === 'forum' && forumStore">
      <PSidebarItem
        :to="moduleUrl('forum')"
        index="1"
        :icon="MessageSquare"
        :active="route && !$route.query.category_id && !$route.query.tag"
        exact
      >
        所有话题
      </PSidebarItem>
      <div v-if="!sidebarCollapsed" class="p-sidebar-divider" />
      <div class="p-sidebar-label">/ CATEGORIES</div>
      <PSidebarItem
        v-for="cat in forumStore.categories"
        :key="cat.id"
        :icon="Folder"
        :active="route && $route.query.category_id === String(cat.id)"
        @click="selectCategory(cat.id)"
      >
        <span class="sidebar-cat-dot" :style="{ background: cat.color || 'var(--a-color-fg)' }" />
        <span style="flex:1">{{ cat.name }}</span>
        <span class="a-label" style="font-size:0.7rem">{{ cat.topic_count || 0 }}</span>
      </PSidebarItem>
      <div v-if="!sidebarCollapsed" class="p-sidebar-divider" />
      <template v-if="!sidebarCollapsed">
        <div class="p-sidebar-label">/ TAGS</div>
        <div style="padding:0.5rem 2rem;display:flex;flex-wrap:wrap;gap:0.35rem">
          <button
            v-for="tag in popularTags"
            :key="tag"
            class="forum-sidebar-tag"
            :class="{ active: route && $route.query.tag === tag }"
            @click="selectTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </template>
    </template>

    <!-- 5. DEBATE MODULE SIDEBAR -->
    <template v-else-if="currentModule === 'debate'">
      <PSidebarItem
        to="/debate"
        :index="1"
        :icon="MessageSquare"
        :active="route && !$route.query.status"
        exact
      >
        全部辩论
      </PSidebarItem>
      <PSidebarItem
        to="/debate?status=open"
        :index="2"
        :icon="Play"
        :active="route && $route.query.status === 'open'"
      >
        进行中
      </PSidebarItem>
      <PSidebarItem
        to="/debate?status=concluded"
        :index="3"
        :icon="CheckCircle"
        :active="route && $route.query.status === 'concluded'"
      >
        已结题
      </PSidebarItem>
      <PSidebarItem
        to="/debate?status=archived"
        :index="4"
        :icon="Archive"
        :active="route && $route.query.status === 'archived'"
      >
        已归档
      </PSidebarItem>
    </template>

    <!-- 6. TIMELINE MODULE SIDEBAR -->
    <template v-else-if="currentModule === 'timeline'">
      <PSidebarItem to="/timeline" :index="1" :icon="Clock" exact>
        时间轴首页
      </PSidebarItem>
      <PSidebarItem to="/timeline/persons" :index="2" :icon="Users">
        人物志
      </PSidebarItem>
    </template>

    <!-- 7. PODCAST MODULE SIDEBAR -->
    <template v-else-if="currentModule === 'podcast'">
      <PSidebarItem to="/podcasts" :index="1" :icon="Mic" exact>
        播客大厅
      </PSidebarItem>
      <PSidebarItem v-if="canPublishPodcast" to="/podcasts/editor" :index="2" :icon="PlusCircle">
        播客创作
      </PSidebarItem>
    </template>

    <!-- 8. VIDEO MODULE SIDEBAR -->
    <template v-else-if="currentModule === 'video'">
      <PSidebarItem to="/videos" :index="1" :icon="Compass" exact>
        探索
      </PSidebarItem>
      <PSidebarItem to="/videos/subscriptions" :index="2" :icon="Rss">
        订阅
      </PSidebarItem>
      <PSidebarItem to="/videos/favorites" :index="3" :icon="Bookmark">
        收藏
      </PSidebarItem>
      <PSidebarItem to="/videos/creator" :index="4" :icon="Settings">
        创作
      </PSidebarItem>
    </template>

    <!-- UNIFIED BOTTOM SLOT -->
    <template #bottom>
      <FeedSidebarSources
        v-if="currentModule === 'feed' && authStore && authStore.isAuthenticated"
        :subscriptions="subscriptions"
        :groups="groups"
        :active-source-id="querySourceId"
        :unread-counts="subscriptionUnreadCounts"
        :collapsed="sidebarCollapsed"
        @select-source="selectSource"
        @select-all="selectAllSources"
        @manage="openManageSheet"
      />
      <MusicSidebarPlaylists
        v-else-if="currentModule === 'music'"
        :collapsed="sidebarCollapsed"
      />
      <div v-else-if="currentModule === 'forum'" style="padding:1rem 2rem;font-size:0.7rem;color:var(--a-color-muted-soft)">
        <div style="margin-bottom:0.25rem"><kbd>J</kbd> <kbd>K</kbd> 上下选择</div>
        <div style="margin-bottom:0.25rem"><kbd>Enter</kbd> 打开话题</div>
        <div style="margin-bottom:0.25rem"><kbd>N</kbd> 发新话题</div>
        <div><kbd>/</kbd> 搜索</div>
      </div>
    </template>
  </PSidebar>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import {
  Rss, Compass, Bookmark, Star, Settings, Disc3, Users,
  MessageSquare, Folder, Play, CheckCircle, Archive, Clock, Mic, PlusCircle
} from 'lucide-vue-next'

import PSidebar from '@/components/ui/PSidebar.vue'
import PSidebarItem from '@/components/ui/PSidebarItem.vue'
import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import MusicSidebarPlaylists from '@/components/music/MusicSidebarPlaylists.vue'

import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { useUIStore } from '@/stores/ui'
import { useForumStore } from '@/stores/forum'
import { useSiteAccessStore } from '@/stores/siteAccess'

import { useSidebar } from '@/composables/useSidebar'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { modulePathUrl, moduleUrl } from '@/router/siteUrls'
import type { Subscription, TimelineItem } from '@/types'

const props = defineProps<{
  module?: string
}>()

// Safe store retrieval
const pinia = getActivePinia()
const authStore = pinia ? useAuthStore() : null
const feedStore = pinia ? useFeedStore() : null
const uiStore = pinia ? useUIStore() : null
const forumStore = pinia ? useForumStore() : null
const siteAccessStore = pinia ? useSiteAccessStore() : null

// Safe route retrieval
let route: any = null
let router: any = null
try {
  route = useRoute()
  router = useRouter()
} catch (e) {
  // Silent fallback in test environments
}

const { sidebarCollapsed } = useSidebar()

// 1. Module detection
const currentModule = computed(() => {
  if (props.module) return props.module
  if (!route || !route.path) return 'feed'
  const path = route.path
  if (path.startsWith('/posts')) return 'blog'
  if (path.startsWith('/music')) return 'music'
  if (path.startsWith('/forum')) return 'forum'
  if (path.startsWith('/debate')) return 'debate'
  if (path.startsWith('/timeline')) return 'timeline'
  if (path.startsWith('/podcasts')) return 'podcast'
  if (path.startsWith('/videos')) return 'video'
  return 'feed'
})

// 2. Feed Navigation Items & Logic
const feedNavItems = [
  { to: moduleUrl('feed'), label: '订阅', icon: Rss, exact: true },
  { to: modulePathUrl('feed', '/explore'), label: '探索', icon: Compass },
  { to: modulePathUrl('feed', '/reading-list'), label: '稍后阅读', icon: Bookmark },
  { to: modulePathUrl('feed', '/starred'), label: '收藏', icon: Star },
]

const { focusedIndex: focusedSidebarIndex } = useKeyboardList({
  items: ref(feedNavItems),
  section: 'sidebar'
})

const subscriptions = computed(() => feedStore ? feedStore.subscriptions : [])
const groups = computed(() => feedStore ? feedStore.groups : [])
const querySourceId = computed(() => (route && typeof route.query.source_id === 'string') ? route.query.source_id : null)

const findSubscriptionByTimelineItem = (item: TimelineItem): Subscription | undefined => {
  if (!feedStore) return undefined
  if (item.type === 'feed_item' && item.feed_item) {
    const sourceId = item.feed_item.feed_source?.id || item.feed_item.feed_source_id
    if (!sourceId) return undefined
    return subscriptions.value.find((sub) => (
      sub.feed_source_id === sourceId
      || sub.feed_source?.id === sourceId
      || (!!item.feed_item?.feed_source?.rss_url && sub.feed_source?.rss_url === item.feed_item.feed_source.rss_url)
    ))
  }

  if (item.type === 'post' && item.post) {
    const channelId = item.post.channel_id || item.post.channel?.id
    if (!channelId) return undefined
    return subscriptions.value.find((sub) => (
      sub.feed_source?.source_type === 'internal_channel'
      && sub.feed_source.source_id === channelId
    ))
  }

  return undefined
}

const subscriptionUnreadCounts = computed(() => {
  if (!feedStore) return {}
  const counts: Record<string, number> = {}
  const hasServerUnreadCounts = subscriptions.value.some((sub) => typeof sub.unread_count === 'number')
  if (hasServerUnreadCounts) {
    subscriptions.value.forEach((sub) => {
      if (typeof sub.unread_count === 'number') {
        counts[sub.id] = sub.unread_count
      }
    })
    return counts
  }

  feedStore.timeline.forEach((item: TimelineItem) => {
    if (item.is_read) return
    const subscription = findSubscriptionByTimelineItem(item)
    if (!subscription) return
    counts[subscription.id] = (counts[subscription.id] || 0) + 1
  })
  return counts
})

const selectSource = (sourceId: string) => {
  if (router) {
    void router.push({ path: moduleUrl('feed'), query: { source_id: sourceId } })
  }
}

const selectAllSources = () => {
  if (router && route) {
    void router.push({
      path: moduleUrl('feed'),
      query: {
        ...route.query,
        source_id: undefined,
        group_id: undefined,
        page: undefined,
      },
    })
  }
}

const openManageSheet = () => {
  if (router && route) {
    void router.push({ path: moduleUrl('feed'), query: { ...route.query, manage_subscriptions: '1' } })
  }
}

// 3. Blog Navigation Items
const blogNavItems = [
  { to: '/posts', label: '探索', icon: Compass, exact: true },
  { to: '/posts/subscriptions', label: '订阅', icon: Rss },
  { to: '/posts/bookmarks', label: '收藏', icon: Bookmark },
  { to: '/posts/manage', label: '创作', icon: Settings },
]

// 4. Music Navigation Items
const musicNavItems = [
  { to: modulePathUrl('music', '/discover'), label: '发现', icon: Compass },
  { to: moduleUrl('music'), label: '专辑', icon: Disc3, exact: true },
  { to: modulePathUrl('music', '/artists'), label: '艺人', icon: Users },
  { to: modulePathUrl('music', '/starred'), label: '收藏', icon: Star },
]

// 5. Forum Logic
const popularTags = computed(() => {
  if (!forumStore) return []
  const tagCount: Record<string, number> = {}
  forumStore.topics.forEach((t) => {
    ;(t.tags || []).forEach((tag) => {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    })
  })
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag]) => tag)
})

const selectCategory = (id: string | number) => {
  if (router) {
    router.push({ path: moduleUrl('forum'), query: { category_id: String(id) } })
  }
}

const selectTag = (tag: string) => {
  if (router && route) {
    if (route.query.tag === tag) {
      router.push({ path: moduleUrl('forum') })
    } else {
      router.push({ path: moduleUrl('forum'), query: { tag } })
    }
  }
}

watch(
  currentModule,
  async (mod) => {
    if (mod === 'forum' && forumStore && forumStore.categories.length === 0) {
      await forumStore.fetchCategories()
    }
  },
  { immediate: true }
)

// 6. Podcast Logic
const canPublishPodcast = computed(() => siteAccessStore ? siteAccessStore.isFeatureEnabled('podcast', 'podcast.publish') : false)
</script>

<style scoped>
.sidebar-cat-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  margin-right: 0.5rem;
  flex-shrink: 0;
}

.forum-sidebar-tag {
  font-size: 0.7rem;
  font-weight: 900;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  transition: all 0.1s;
  text-transform: uppercase;
}

.forum-sidebar-tag:hover {
  border-color: var(--a-color-fg);
  color: var(--a-color-fg);
}

.forum-sidebar-tag.active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}
</style>
