<template>
  <section
    v-if="shouldRender"
    class="subscription-hub-sidebar"
    :class="{ 'is-collapsed': collapsed }"
    aria-label="订阅"
  >
    <template v-if="!collapsed">
      <header class="subscription-hub-sidebar__header">
        <p class="subscription-hub-sidebar__eyebrow a-font-meta">我的订阅</p>
        <button
          type="button"
          class="subscription-hub-sidebar__manage"
          data-testid="subscription-hub-manage"
          aria-label="管理订阅"
          title="管理订阅"
          @click="emit('manage')"
        >
          <Settings2 :size="17" aria-hidden="true" />
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
          v-for="typeNode in typeNodes"
          :key="typeNode.subscription_type"
          class="subscription-hub-sidebar__type"
        >
          <div
            v-if="!isFixedType"
            class="subscription-hub-sidebar__type-row"
            :class="{ 'is-active': typeNode.subscription_type === activeType }"
          >
            <button
              type="button"
              class="subscription-hub-sidebar__type-select"
              :data-testid="`subscription-hub-type-${typeNode.subscription_type}`"
              :aria-current="typeNode.subscription_type === activeType ? 'page' : undefined"
              :aria-expanded="expandedType === typeNode.subscription_type"
              :aria-controls="typePanelId(typeNode.subscription_type)"
              @click="selectType(typeNode.subscription_type)"
            >
              <component :is="typeIcon(typeNode.subscription_type)" :size="15" aria-hidden="true" />
              <span class="subscription-hub-sidebar__type-label">{{ typeLabel(typeNode.subscription_type) }}</span>
              <span class="subscription-hub-sidebar__total a-font-meta">{{ membershipCount(typeNode) }}</span>
              <ChevronRight
                :size="15"
                aria-hidden="true"
                :class="{ 'is-expanded': expandedType === typeNode.subscription_type }"
              />
            </button>
          </div>

          <div
            v-if="isFixedType || expandedType === typeNode.subscription_type"
            :id="isFixedType ? undefined : typePanelId(typeNode.subscription_type)"
            class="subscription-hub-sidebar__groups"
            :class="{ 'is-flat': isFixedType }"
          >
            <button
              v-if="isFixedType"
              type="button"
              class="subscription-hub-sidebar__all"
              :class="{ 'is-active': !activeGroupId && !activeMembershipId }"
              :data-testid="`subscription-hub-all-${typeNode.subscription_type}`"
              :aria-current="!activeGroupId && !activeMembershipId ? 'page' : undefined"
              @click="selectType(typeNode.subscription_type)"
            >
              <List :size="15" aria-hidden="true" />
              <span>全部来源</span>
              <span class="subscription-hub-sidebar__total a-font-meta">{{ membershipCount(typeNode) }}</span>
            </button>
            <p v-if="!typeNode.groups.length" class="subscription-hub-sidebar__empty">尚无订阅</p>
            <template v-else>
              <section
                v-for="group in typeNode.groups"
                :key="group.id"
                class="subscription-hub-sidebar__group"
              >
                <div
                  v-if="!isSingleDefaultGroup(typeNode)"
                  class="subscription-hub-sidebar__group-row"
                  :class="{
                    'is-active': group.id === activeGroupId && !activeMembershipId,
                  }"
                >
                  <button
                    type="button"
                    class="subscription-hub-sidebar__group-select"
                    :data-testid="`subscription-hub-group-${group.id}`"
                    :aria-current="group.id === activeGroupId && !activeMembershipId ? 'page' : undefined"
                    :aria-expanded="expandedGroupId === group.id"
                    :aria-controls="groupPanelId(group.id)"
                    @click="selectGroup(typeNode.subscription_type, group.id)"
                  >
                    <span>{{ group.name }}</span>
                    <span class="subscription-hub-sidebar__total a-font-meta">{{ group.memberships.length }}</span>
                    <ChevronRight
                      :size="13"
                      aria-hidden="true"
                      :class="{ 'is-expanded': expandedGroupId === group.id }"
                    />
                  </button>
                </div>

                <div
                  v-if="isSingleDefaultGroup(typeNode) || expandedGroupId === group.id"
                  :id="isSingleDefaultGroup(typeNode) ? undefined : groupPanelId(group.id)"
                  class="subscription-hub-sidebar__memberships"
                  :class="{ 'is-flat': isFixedType && isSingleDefaultGroup(typeNode) }"
                >
                  <p v-if="!group.memberships.length" class="subscription-hub-sidebar__empty">尚无订阅</p>
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
                    <PAvatar
                      :src="membershipAvatarURL(membership)"
                      :name="membershipTitle(membership)"
                      :alt="`${membershipTitle(membership)}的头像`"
                      size="xs"
                    />
                    <span class="subscription-hub-sidebar__membership-copy">
                      <span class="subscription-hub-sidebar__membership-name">
                        {{ membershipTitle(membership) }}
                      </span>
                      <span
                        v-if="membershipSourceTypeLabel(membership)"
                        class="subscription-hub-sidebar__membership-source-type a-font-meta"
                      >
                        {{ membershipSourceTypeLabel(membership) }}
                      </span>
                    </span>
                    <span
                      v-if="membershipStatusLabel(membership)"
                      class="subscription-hub-sidebar__membership-status"
                      data-test="subscription-hub-membership-status"
                      :aria-label="membershipStatusLabel(membership)"
                      :title="membershipStatusLabel(membership)"
                    >
                      <span aria-hidden="true" />
                    </span>
                  </button>
                </div>
              </section>
            </template>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  IconChevronRight as ChevronRight,
  IconFileText as FileText,
  IconList as List,
  IconMicrophone as Mic,
  IconRss as Rss,
  IconSettings2 as Settings2,
  IconVideo as Video,
} from '@tabler/icons-vue'

import PAvatar from '@/components/ui/PAvatar.vue'
import type { SubscriptionHubMembership, SubscriptionHubSelection, SubscriptionHubTree, SubscriptionHubType, SubscriptionHubTypeNode } from '@/types'
import { buildSourceFaviconURL, normalizeSourceUrlForCard } from '@/utils/feedSourcePresentation'

const props = withDefaults(defineProps<{
  tree: SubscriptionHubTree
  activeType?: SubscriptionHubType | null
  activeGroupId?: string | null
  activeMembershipId?: string | null
  loading?: boolean
  error?: string
  collapsed?: boolean
  idPrefix?: string
  fixedType?: SubscriptionHubType | null
}>(), {
  activeType: null,
  activeGroupId: null,
  activeMembershipId: null,
  loading: false,
  error: '',
  collapsed: false,
  idPrefix: 'subscription-hub',
  fixedType: null,
})

const emit = defineEmits<{
  (e: 'select-context', value: SubscriptionHubSelection): void
  (e: 'manage'): void
  (e: 'retry'): void
}>()

const isFixedType = computed(() => props.fixedType !== null)
const typeNodes = computed(() => {
  if (!props.fixedType) return props.tree.types.filter((node) => membershipCount(node) > 0)
  return props.tree.types.filter((node) =>
    node.subscription_type === props.fixedType && node.has_content !== false,
  )
})
const shouldRender = computed(() => !isFixedType.value || props.loading || !!props.error || typeNodes.value.length > 0)
const expandedType = ref<SubscriptionHubType | null>(null)
const expandedGroupId = ref<string | null>(null)

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

const membershipSourceTypeLabel = (membership: SubscriptionHubMembership) => {
  switch (membership.feed_source?.source_type) {
    case 'internal_user':
      return '账户'
    case 'internal_channel':
    case 'internal_collection':
      return '频道'
    case 'external_rss':
      return `RSS${membership.feed_source.rss_url ? ` · ${normalizeSourceUrlForCard(membership.feed_source.rss_url)}` : ''}`
    default:
      return ''
  }
}

const membershipTitle = (membership: SubscriptionHubMembership) =>
  membership.title || membership.feed_source?.title || '未命名订阅'

const membershipAvatarURL = (membership: SubscriptionHubMembership) =>
  membership.feed_source?.cover_url
  || (membership.feed_source?.source_type === 'external_rss'
    ? buildSourceFaviconURL(membership.feed_source.rss_url)
    : '')

const membershipStatusLabel = (membership: SubscriptionHubMembership) => {
  switch (membership.feed_source?.fetch_status) {
    case 'fetching':
      return '正在同步'
    case 'warning':
      return '等待重试'
    case 'blocked':
      return '来源异常'
    default:
      return ''
  }
}

const membershipCount = (typeNode: SubscriptionHubTypeNode) =>
  typeNode.groups.reduce((count, group) => count + group.memberships.length, 0)

const typePanelId = (subscriptionType: SubscriptionHubType) => `${props.idPrefix}-type-panel-${subscriptionType}`
const groupPanelId = (groupId: string) => `${props.idPrefix}-group-panel-${groupId}`
const isSingleDefaultGroup = (typeNode: SubscriptionHubTypeNode) =>
  typeNode.groups.length === 1 && typeNode.groups[0]?.name === '默认分组'

const firstGroupId = (typeNode?: SubscriptionHubTypeNode) => typeNode?.groups[0]?.id ?? null

const initialType = () => {
  if (props.activeType && typeNodes.value.some((node) => node.subscription_type === props.activeType)) {
    return props.activeType
  }
  return typeNodes.value.find((node) => membershipCount(node) > 0)?.subscription_type
    ?? typeNodes.value[0]?.subscription_type
    ?? null
}

watch(
  [() => props.activeType, () => props.activeGroupId, () => props.fixedType, () => props.tree.types],
  ([activeType, activeGroupId]) => {
    const activeNode = activeType
      ? typeNodes.value.find((node) => node.subscription_type === activeType)
      : undefined
    if (activeNode) {
      expandedType.value = activeType
      expandedGroupId.value = activeGroupId && activeNode.groups.some((group) => group.id === activeGroupId)
        ? activeGroupId
        : firstGroupId(activeNode)
      return
    }

    const currentTypeExists = expandedType.value
      && typeNodes.value.some((node) => node.subscription_type === expandedType.value)
    if (!currentTypeExists) expandedType.value = initialType()

    const expandedNode = typeNodes.value.find((node) => node.subscription_type === expandedType.value)
    if (!expandedNode || !expandedNode.groups.some((group) => group.id === expandedGroupId.value)) {
      expandedGroupId.value = firstGroupId(expandedNode)
    }
  },
  { immediate: true, deep: true },
)

const setExpandedType = (subscriptionType: SubscriptionHubType, groupId?: string | null) => {
  expandedType.value = subscriptionType
  const node = typeNodes.value.find((typeNode) => typeNode.subscription_type === subscriptionType)
  expandedGroupId.value = groupId ?? firstGroupId(node)
}

const selectType = (subscriptionType: SubscriptionHubType) => {
  setExpandedType(subscriptionType)
  emit('select-context', { subscriptionType })
}

const selectGroup = (subscriptionType: SubscriptionHubType, groupId: string) => {
  setExpandedType(subscriptionType, groupId)
  emit('select-context', { subscriptionType, groupId })
}

</script>

<style scoped>
.subscription-hub-sidebar {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 0.7rem;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.subscription-hub-sidebar.is-collapsed {
  padding: 0;
}

.subscription-hub-sidebar__header,
.subscription-hub-sidebar__type-row,
.subscription-hub-sidebar__group-row,
.subscription-hub-sidebar__membership,
.subscription-hub-sidebar__error {
  display: flex;
  align-items: center;
}

.subscription-hub-sidebar__header {
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.75rem;
}

.subscription-hub-sidebar__eyebrow {
  min-width: 0;
  flex: 1;
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0;
}

.subscription-hub-sidebar__manage {
  border: 0;
  display: grid;
  flex: none;
  width: 2.75rem;
  min-height: 2.75rem;
  place-items: center;
  padding: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
}

.subscription-hub-sidebar__manage:hover {
  background: var(--a-color-surface-muted);
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
  padding: 0.1rem 0 0.35rem 0.35rem;
}

.subscription-hub-sidebar__groups.is-flat {
  padding-left: 0;
}

.subscription-hub-sidebar__memberships {
  gap: 0.05rem;
  padding: 0.05rem 0 0.25rem 1.55rem;
}

.subscription-hub-sidebar__memberships.is-flat {
  padding-left: 0.55rem;
}

.subscription-hub-sidebar__type-select,
.subscription-hub-sidebar__group-select,
.subscription-hub-sidebar__all,
.subscription-hub-sidebar__membership {
  border: 0;
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.subscription-hub-sidebar__type-row {
  min-width: 0;
  border-left: 3px solid transparent;
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
}

.subscription-hub-sidebar__type-row.is-active {
  border-left-color: var(--a-color-text);
}

.subscription-hub-sidebar__type-select {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.75rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
}

.subscription-hub-sidebar__group-row {
  min-width: 0;
  border-left: 3px solid transparent;
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
}

.subscription-hub-sidebar__group-row.is-active {
  border-left-color: var(--a-color-text);
}

.subscription-hub-sidebar__group-select {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.5rem;
  padding: 0.3rem 0.45rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.subscription-hub-sidebar__group-select span:first-child,
.subscription-hub-sidebar__type-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-hub-sidebar__membership {
  min-width: 0;
  border-left: 3px solid transparent;
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
  gap: 0.55rem;
  min-height: 3rem;
  padding: 0.38rem 0.55rem;
  font-size: 0.8rem;
}

.subscription-hub-sidebar__membership-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.12rem;
}

.subscription-hub-sidebar__membership-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-hub-sidebar__membership-source-type {
  min-width: 0;
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.66rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-hub-sidebar__membership-status {
  display: grid;
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  place-items: center;
}

.subscription-hub-sidebar__membership-status > span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--a-color-danger, #b91c1c);
}

.subscription-hub-sidebar__type-select:hover,
.subscription-hub-sidebar__group-select:hover,
.subscription-hub-sidebar__all:hover,
.subscription-hub-sidebar__membership:hover,
.subscription-hub-sidebar__type-row.is-active,
.subscription-hub-sidebar__group-row.is-active,
.subscription-hub-sidebar__membership.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.subscription-hub-sidebar__membership.is-active {
  border-left-color: var(--a-color-text);
}

.subscription-hub-sidebar__type-select:focus-visible,
.subscription-hub-sidebar__group-select:focus-visible,
.subscription-hub-sidebar__all:focus-visible,
.subscription-hub-sidebar__membership:focus-visible,
.subscription-hub-sidebar__manage:focus-visible,
.subscription-hub-sidebar__error button:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: -2px;
}

.subscription-hub-sidebar__total {
  margin-left: auto;
  color: var(--a-color-muted);
  font-size: 0.66rem;
}

.subscription-hub-sidebar__type-select svg:last-child,
.subscription-hub-sidebar__group-select svg:last-child {
  transition: transform 0.15s ease;
}

.subscription-hub-sidebar__type-select svg.is-expanded,
.subscription-hub-sidebar__group-select svg.is-expanded {
  transform: rotate(90deg);
}

.subscription-hub-sidebar__all {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.75rem;
  padding: 0.4rem 0.55rem;
  border-left: 3px solid transparent;
  border-radius: 0 var(--a-radius-control) var(--a-radius-control) 0;
  font-size: 0.84rem;
  font-weight: 600;
}

.subscription-hub-sidebar__all.is-active {
  border-left-color: var(--a-color-text);
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.subscription-hub-sidebar__empty {
  margin: 0;
  padding: 0.35rem 0.55rem 0.5rem 1.75rem;
  color: var(--a-color-muted);
  font-size: 0.76rem;
}

.subscription-hub-sidebar__groups.is-flat > .subscription-hub-sidebar__empty {
  padding-left: 0.55rem;
}

@media (prefers-reduced-motion: reduce) {
  .subscription-hub-sidebar__type-select svg:last-child,
  .subscription-hub-sidebar__group-select svg:last-child {
    transition: none;
  }
}
</style>
