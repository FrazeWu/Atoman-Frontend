<template>
  <section class="feed-sidebar-sources" :class="{ 'is-collapsed': collapsed }" aria-label="订阅源类别">
    <template v-if="!collapsed">
      <header class="feed-sidebar-sources__header">
        <p class="feed-sidebar-sources__eyebrow a-font-meta">订阅源类别 / SOURCES</p>
        <button
          type="button"
          class="feed-sidebar-sources__manage a-font-meta"
          data-testid="feed-sidebar-manage"
          @click="emit('manage')"
        >
          管理
        </button>
      </header>

      <input
        v-if="subscriptions.length"
        v-model="searchQuery"
        data-test="feed-sidebar-source-search"
        class="feed-sidebar-sources__search"
        type="search"
        placeholder="搜索来源"
        aria-label="搜索订阅源"
      />

      <button
        v-if="subscriptions.length"
        type="button"
        data-test="feed-sidebar-all-sources"
        class="feed-sidebar-sources__all"
        :class="{ 'is-active': !activeSourceId }"
        @click="emit('select-all')"
      >
        全部订阅
      </button>

      <button
        v-if="hasUnreadSources"
        type="button"
        data-test="feed-sidebar-unread-only"
        class="feed-sidebar-sources__filter"
        :class="{ 'is-active': unreadOnly }"
        @click="unreadOnly = !unreadOnly"
      >
        有未读
      </button>

      <div v-if="visibleGroups.length" class="feed-sidebar-sources__groups">
        <div v-for="group in visibleGroups" :key="group.id" class="feed-sidebar-sources__group">
          <button
            type="button"
            class="feed-sidebar-sources__group-title"
            :data-test="`feed-sidebar-group-${group.id}`"
            @click="toggleGroup(group.id)"
          >
            <span>{{ collapsedGroups.has(group.id) ? '▹' : '▱' }} {{ group.name }}</span>
          </button>
          <div v-if="!collapsedGroups.has(group.id)" class="feed-sidebar-sources__items">
            <button
              v-for="sub in group.subscriptions"
              :key="sub.id"
              type="button"
              class="feed-sidebar-sources__item"
              :class="{ 'is-active': sub.id === activeSourceId }"
              :data-source-id="sub.id"
              @click="emit('select-source', sub.id)"
            >
              <span class="feed-sidebar-sources__badge a-font-meta">{{ sourceBadge(sub) }}</span>
              <span class="feed-sidebar-sources__name">{{ sourceTitle(sub) }}</span>
              <span
                v-if="sourceHealthLabel(sub)"
                class="feed-sidebar-sources__health a-font-meta"
                :class="`is-${sub.health_status}`"
              >
                {{ sourceHealthLabel(sub) }}
              </span>
              <span
                v-if="unreadCount(sub.id) > 0"
                class="feed-sidebar-sources__count a-font-meta"
                :data-test="`feed-sidebar-unread-count-${sub.id}`"
              >
                {{ unreadCount(sub.id) }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <p v-else class="feed-sidebar-sources__empty">暂无订阅源</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Subscription, SubscriptionGroup } from '@/types'
import { subscriptionDisplayTitle } from '@/utils/feedTitles'

const props = withDefaults(
  defineProps<{
    subscriptions: Subscription[]
    groups: SubscriptionGroup[]
    activeSourceId?: string | null
    collapsed?: boolean
    unreadCounts?: Record<string, number>
  }>(),
  {
    activeSourceId: null,
    collapsed: false,
    unreadCounts: () => ({}),
  },
)

const emit = defineEmits<{
  (e: 'select-source', sourceId: string): void
  (e: 'select-all'): void
  (e: 'manage'): void
}>()

const searchQuery = ref('')
const unreadOnly = ref(false)
const collapsedGroups = ref(new Set<string>())

interface VisibleGroup {
  id: string
  name: string
  subscriptions: Subscription[]
}

const visibleGroups = computed<VisibleGroup[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const unreadFiltered = unreadOnly.value
    ? props.subscriptions.filter((sub) => unreadCount(sub.id) > 0)
    : props.subscriptions
  const matchingSubscriptions = query
    ? unreadFiltered.filter((sub) => {
        const haystack = [
          sourceTitle(sub),
          sub.feed_source?.title,
          sub.feed_source?.rss_url,
        ].join(' ').toLowerCase()
        return haystack.includes(query)
      })
    : unreadFiltered
  const groupIds = new Set(props.groups.map((group) => group.id))
  const grouped = props.groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      subscriptions: matchingSubscriptions.filter((sub) => sub.subscription_group_id === group.id),
    }))
    .filter((group) => group.subscriptions.length > 0)

  const unassigned = matchingSubscriptions.filter(
    (sub) => !sub.subscription_group_id || !groupIds.has(sub.subscription_group_id),
  )
  if (unassigned.length > 0) {
    grouped.push({
      id: 'unassigned',
      name: '未分类',
      subscriptions: unassigned,
    })
  }

  return grouped
})

function sourceTitle(sub: Subscription): string {
  return subscriptionDisplayTitle(sub)
}

function sourceBadge(sub: Subscription): string {
  const title = sourceTitle(sub).toLowerCase()
  const rssUrl = (sub.feed_source?.rss_url ?? '').toLowerCase()

  if (title.includes('播客') || rssUrl.includes('podcast')) return '播客'
  if (title.includes('周报') || title.includes('newsletter') || rssUrl.includes('newsletter')) return '周报'

  return '文章'
}

function sourceHealthLabel(sub: Subscription): string {
  if (!sub.health_status || sub.health_status === 'healthy') return ''
  if (sub.health_status === 'warning') return '警告'
  return '异常'
}

const hasUnreadSources = computed(() =>
  props.subscriptions.some((sub) => unreadCount(sub.id) > 0),
)

function unreadCount(subscriptionId: string): number {
  return Math.max(0, props.unreadCounts[subscriptionId] || 0)
}

function toggleGroup(groupId: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }
  collapsedGroups.value = next
}
</script>

<style scoped>
.feed-sidebar-sources {
  display: grid;
  gap: 0.9rem;
  padding: 0.95rem 0.85rem;
  background: #ffffff;
  color: #0f172a;
}

.feed-sidebar-sources.is-collapsed {
  padding: 0;
}

.feed-sidebar-sources__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.feed-sidebar-sources__eyebrow {
  margin: 0;
  color: #334155;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
}

.feed-sidebar-sources__manage {
  border: 0;
  padding: 0;
  background: transparent;
  color: #0f172a;
  cursor: pointer;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
}

.feed-sidebar-sources__manage:hover {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.feed-sidebar-sources__groups {
  display: grid;
  gap: 1rem;
}

.feed-sidebar-sources__search {
  width: 100%;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.45rem 0.55rem;
  background: #ffffff;
  color: #0f172a;
  font: inherit;
  font-size: 0.78rem;
}

.feed-sidebar-sources__filter {
  justify-self: start;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.28rem 0.5rem;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 900;
}

.feed-sidebar-sources__all {
  width: 100%;
  border: 1px solid var(--a-color-line-soft);
  padding: 0.48rem 0.55rem;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 900;
  text-align: left;
}

.feed-sidebar-sources__all.is-active {
  background: var(--a-color-paper-wash);
}

.feed-sidebar-sources__filter.is-active {
  background: #0f172a;
  color: #ffffff;
}

.feed-sidebar-sources__group {
  display: grid;
  gap: 0.45rem;
}

.feed-sidebar-sources__group-title {
  margin: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: #475569;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: left;
  cursor: pointer;
}

.feed-sidebar-sources__items {
  display: grid;
  gap: 0.35rem;
}

.feed-sidebar-sources__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  border: 0;
  padding: 0.5rem 0.55rem;
  background: transparent;
  color: #0f172a;
  text-align: left;
  cursor: pointer;
  border-radius: 0;
  transition: all 0.2s;
}

.feed-sidebar-sources__count {
  min-width: 1.35rem;
  padding: 0.12rem 0.34rem;
  background: #0f172a;
  color: #ffffff;
  font-size: 0.58rem;
  text-align: center;
}

.feed-sidebar-sources__health {
  color: #b45309;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
}

.feed-sidebar-sources__health.is-error {
  color: #b91c1c;
}

.feed-sidebar-sources__item:hover {
  background-color: transparent;
  color: var(--a-color-ink);
}

.feed-sidebar-sources__item:hover .feed-sidebar-sources__name {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.feed-sidebar-sources__item.is-active {
  background-color: transparent;
  box-shadow: none;
  font-weight: 800;
  color: var(--a-color-ink);
}

.feed-sidebar-sources__badge {
  padding: 0.18rem 0.34rem;
  background: #e2e8f0;
  color: #334155;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
}

.feed-sidebar-sources__name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-sidebar-sources__empty {
  margin: 0;
  padding: 0.75rem 0.55rem;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.82rem;
}
</style>
