<template>
  <section
    class="subscription-hub-sidebar"
    :class="{ 'is-collapsed': collapsed }"
    aria-label="订阅"
  >
    <template v-if="!collapsed">
      <header class="subscription-hub-sidebar__header">
        <p class="subscription-hub-sidebar__eyebrow a-font-meta">订阅 / SUBSCRIPTIONS</p>
        <button
          type="button"
          class="subscription-hub-sidebar__manage a-font-meta"
          data-testid="subscription-hub-manage-rss"
          @click="emit('manage-rss')"
        >
          RSS 管理
        </button>
      </header>

      <div v-if="loading" class="subscription-hub-sidebar__skeleton" aria-label="正在加载订阅">
        <span v-for="index in 4" :key="index" class="a-skeleton" />
      </div>

      <div v-else-if="error" class="subscription-hub-sidebar__error" role="alert">
        <span>{{ error }}</span>
        <button type="button" data-testid="subscription-hub-retry" @click="emit('retry')">重试</button>
      </div>

      <div v-else class="subscription-hub-sidebar__types">
        <section
          v-for="typeNode in tree.types"
          :key="typeNode.subscription_type"
          class="subscription-hub-sidebar__type"
        >
          <button
            type="button"
            class="subscription-hub-sidebar__type-button"
            :class="{ 'is-active': typeNode.subscription_type === activeType }"
            :data-testid="`subscription-hub-type-${typeNode.subscription_type}`"
            :aria-expanded="!collapsedTypes.has(typeNode.subscription_type)"
            @click="selectType(typeNode.subscription_type)"
          >
            <component :is="typeIcon(typeNode.subscription_type)" :size="15" aria-hidden="true" />
            <span>{{ typeLabel(typeNode.subscription_type) }}</span>
            <span class="subscription-hub-sidebar__total a-font-meta">{{ membershipCount(typeNode) }}</span>
            <ChevronRight
              :size="15"
              aria-hidden="true"
              :class="{ 'is-expanded': !collapsedTypes.has(typeNode.subscription_type) }"
            />
          </button>

          <div v-if="!collapsedTypes.has(typeNode.subscription_type)" class="subscription-hub-sidebar__groups">
            <p v-if="!typeNode.groups.length" class="subscription-hub-sidebar__empty">尚无订阅</p>
            <section
              v-for="group in typeNode.groups"
              :key="group.id"
              class="subscription-hub-sidebar__group"
            >
              <button
                type="button"
                class="subscription-hub-sidebar__group-button"
                :class="{
                  'is-active': group.id === activeGroupId && !activeMembershipId,
                }"
                :data-testid="`subscription-hub-group-${group.id}`"
                :aria-expanded="!collapsedGroups.has(group.id)"
                @click="selectGroup(typeNode.subscription_type, group.id)"
              >
                <ChevronRight
                  :size="13"
                  aria-hidden="true"
                  :class="{ 'is-expanded': !collapsedGroups.has(group.id) }"
                />
                <span>{{ group.name }}</span>
                <span class="subscription-hub-sidebar__total a-font-meta">{{ group.memberships.length }}</span>
              </button>

              <div v-if="!collapsedGroups.has(group.id)" class="subscription-hub-sidebar__memberships">
                <button
                  v-for="membership in group.memberships"
                  :key="membership.id"
                  type="button"
                  class="subscription-hub-sidebar__membership"
                  :class="{ 'is-active': membership.id === activeMembershipId }"
                  :data-testid="`subscription-hub-membership-${membership.id}`"
                  @click="emit('select-context', {
                    subscriptionType: typeNode.subscription_type,
                    groupId: group.id,
                    membershipId: membership.id,
                  })"
                >
                  <span>{{ membership.title || membership.feed_source?.title || '未命名订阅' }}</span>
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconChevronRight as ChevronRight, IconFileText as FileText, IconMicrophone as Mic, IconRss as Rss, IconVideo as Video } from '@tabler/icons-vue'

import type { SubscriptionHubTree, SubscriptionHubType, SubscriptionHubTypeNode } from '@/types'

const props = withDefaults(defineProps<{
  tree: SubscriptionHubTree
  activeType?: SubscriptionHubType | null
  activeGroupId?: string | null
  activeMembershipId?: string | null
  loading?: boolean
  error?: string
  collapsed?: boolean
}>(), {
  activeType: null,
  activeGroupId: null,
  activeMembershipId: null,
  loading: false,
  error: '',
  collapsed: false,
})

const emit = defineEmits<{
  (e: 'select-context', value: { subscriptionType: SubscriptionHubType; groupId: string; membershipId?: string }): void
  (e: 'manage-rss'): void
  (e: 'retry'): void
}>()

const collapsedTypes = ref(new Set<SubscriptionHubType>())
const collapsedGroups = ref(new Set<string>())

const typeNodes = computed(() => props.tree.types)

const typeLabel = (subscriptionType: SubscriptionHubType) => ({
  podcast: '播客',
  video: '视频',
  blog: '博客',
  rss: 'RSS',
}[subscriptionType])

const typeIcon = (subscriptionType: SubscriptionHubType) => ({
  podcast: Mic,
  video: Video,
  blog: FileText,
  rss: Rss,
}[subscriptionType])

const membershipCount = (typeNode: SubscriptionHubTypeNode) =>
  typeNode.groups.reduce((count, group) => count + group.memberships.length, 0)

const toggleSetValue = <T,>(values: Set<T>, value: T) => {
  const next = new Set(values)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

const selectType = (subscriptionType: SubscriptionHubType) => {
  if (props.activeType === subscriptionType) {
    collapsedTypes.value = toggleSetValue(collapsedTypes.value, subscriptionType)
  } else if (collapsedTypes.value.has(subscriptionType)) {
    collapsedTypes.value = toggleSetValue(collapsedTypes.value, subscriptionType)
  }
  const group = typeNodes.value.find((node) => node.subscription_type === subscriptionType)?.groups[0]
  if (group) emit('select-context', { subscriptionType, groupId: group.id })
}

const selectGroup = (subscriptionType: SubscriptionHubType, groupId: string) => {
  if (props.activeType === subscriptionType && props.activeGroupId === groupId && !props.activeMembershipId) {
    collapsedGroups.value = toggleSetValue(collapsedGroups.value, groupId)
  } else if (collapsedGroups.value.has(groupId)) {
    collapsedGroups.value = toggleSetValue(collapsedGroups.value, groupId)
  }
  emit('select-context', { subscriptionType, groupId })
}
</script>

<style scoped>
.subscription-hub-sidebar {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem 0.85rem;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.subscription-hub-sidebar.is-collapsed {
  padding: 0;
}

.subscription-hub-sidebar__header,
.subscription-hub-sidebar__type-button,
.subscription-hub-sidebar__group-button,
.subscription-hub-sidebar__membership,
.subscription-hub-sidebar__error {
  display: flex;
  align-items: center;
}

.subscription-hub-sidebar__header {
  justify-content: space-between;
  gap: 0.75rem;
}

.subscription-hub-sidebar__eyebrow {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.68rem;
  letter-spacing: 0;
}

.subscription-hub-sidebar__manage {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
}

.subscription-hub-sidebar__manage:hover {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.subscription-hub-sidebar__skeleton {
  display: grid;
  gap: 0.5rem;
}

.subscription-hub-sidebar__skeleton span {
  display: block;
  height: 2.5rem;
}

.subscription-hub-sidebar__error {
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--a-color-danger, #b91c1c);
  font-size: 0.8rem;
}

.subscription-hub-sidebar__error button {
  border: 0;
  padding: 0.35rem 0.5rem;
  background: var(--a-color-surface-muted);
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.subscription-hub-sidebar__types,
.subscription-hub-sidebar__groups,
.subscription-hub-sidebar__memberships {
  display: grid;
}

.subscription-hub-sidebar__types {
  gap: 0.2rem;
}

.subscription-hub-sidebar__groups {
  gap: 0.15rem;
  padding: 0.1rem 0 0.45rem 0.4rem;
}

.subscription-hub-sidebar__memberships {
  padding: 0.1rem 0 0.25rem 1.55rem;
}

.subscription-hub-sidebar__type-button,
.subscription-hub-sidebar__group-button,
.subscription-hub-sidebar__membership {
  width: 100%;
  min-height: 2.5rem;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.subscription-hub-sidebar__type-button {
  gap: 0.55rem;
  padding: 0.4rem 0.55rem;
  font-size: 0.88rem;
  font-weight: 600;
}

.subscription-hub-sidebar__group-button {
  gap: 0.35rem;
  padding: 0.3rem 0.45rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.subscription-hub-sidebar__membership {
  min-width: 0;
  padding: 0.38rem 0.55rem;
  font-size: 0.8rem;
}

.subscription-hub-sidebar__membership span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-hub-sidebar__type-button:hover,
.subscription-hub-sidebar__group-button:hover,
.subscription-hub-sidebar__membership:hover,
.subscription-hub-sidebar__type-button.is-active,
.subscription-hub-sidebar__group-button.is-active,
.subscription-hub-sidebar__membership.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.subscription-hub-sidebar__type-button.is-active,
.subscription-hub-sidebar__group-button.is-active,
.subscription-hub-sidebar__membership.is-active {
  border-left-color: var(--a-color-text);
}

.subscription-hub-sidebar__type-button:focus-visible,
.subscription-hub-sidebar__group-button:focus-visible,
.subscription-hub-sidebar__membership:focus-visible,
.subscription-hub-sidebar__error button:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: -2px;
}

.subscription-hub-sidebar__total {
  margin-left: auto;
  color: var(--a-color-muted);
  font-size: 0.66rem;
}

.subscription-hub-sidebar__type-button > :last-child,
.subscription-hub-sidebar__group-button > :first-child {
  transition: transform 0.15s ease;
}

.subscription-hub-sidebar__type-button > :last-child.is-expanded,
.subscription-hub-sidebar__group-button > :first-child.is-expanded {
  transform: rotate(90deg);
}

.subscription-hub-sidebar__empty {
  margin: 0;
  padding: 0.35rem 0.55rem 0.5rem 1.75rem;
  color: var(--a-color-muted);
  font-size: 0.76rem;
}

@media (prefers-reduced-motion: reduce) {
  .subscription-hub-sidebar__type-button > :last-child,
  .subscription-hub-sidebar__group-button > :first-child {
    transition: none;
  }
}
</style>
