<template>
  <section
    v-if="shouldRender"
    ref="sidebarRef"
    class="subscription-hub-sidebar"
    :class="{ 'is-collapsed': collapsed }"
    :style="{ '--scroll-progress': String(scrollProgress) }"
    aria-label="订阅"
    @scroll.passive="updateScrollProgress"
  >
    <template v-if="!collapsed">
      <header class="subscription-hub-sidebar__header">
        <p class="a-font-meta">我的订阅</p>
        <button
          type="button"
          data-testid="subscription-hub-manage"
          aria-label="管理订阅"
          title="管理订阅"
          @click="emit('manage')"
        >
          <Settings2 :size="17" />
        </button>
      </header>
      <div
        v-if="loading"
        class="subscription-hub-sidebar__skeleton"
        aria-label="正在加载订阅"
      >
        <span v-for="index in 4" :key="index" class="a-skeleton" />
      </div>
      <div
        v-else-if="error"
        class="subscription-hub-sidebar__error"
        role="alert"
      >
        <span>{{ error }}</span
        ><button
          type="button"
          data-testid="subscription-hub-retry"
          @click="emit('retry')"
        >
          重试
        </button>
      </div>
      <div v-else class="subscription-hub-sidebar__list">
        <button
          v-for="row in sourceRows"
          :key="row.membership.id"
            type="button"
            class="subscription-hub-sidebar__source"
          :class="{ 'is-active': row.membership.id === activeMembershipId }"
          :data-testid="`subscription-hub-membership-${row.membership.id}`"
            @click="
              emit('select-context', {
              subscriptionType: row.subscriptionType,
              groupId: row.membership.group_id,
              membershipId: row.membership.id,
              })
            "
          >
          <span>{{ sourceType(row.membership, row.subscriptionType) }}</span
            ><PAvatar
            :src="avatar(row.membership)"
            :name="title(row.membership)"
            :alt="`${title(row.membership)}的头像`"
              size="xs"
            /><span class="subscription-hub-sidebar__name">{{
            title(row.membership)
            }}</span
          ><span :class="{ 'is-zero': unread(row.membership) === 0 }">{{
            unread(row.membership)
            }}</span>
          </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { IconSettings2 as Settings2 } from "@tabler/icons-vue";
import PAvatar from "@/components/ui/PAvatar.vue";
import type {
  SubscriptionHubMembership,
  SubscriptionHubSelection,
  SubscriptionHubTree,
  SubscriptionHubType,
  SubscriptionHubTypeNode,
} from "@/types";
import { buildSourceFaviconURL } from "@/utils/feedSourcePresentation";
const props = withDefaults(
  defineProps<{
    tree: SubscriptionHubTree;
    activeType?: SubscriptionHubType | null;
    activeGroupId?: string | null;
    activeMembershipId?: string | null;
    loading?: boolean;
    error?: string;
    collapsed?: boolean;
    fixedType?: SubscriptionHubType | null;
  }>(),
  {
    activeType: null,
    activeGroupId: null,
    activeMembershipId: null,
    loading: false,
    error: "",
    collapsed: false,
    fixedType: null,
  },
);
const emit = defineEmits<{
  (e: "select-context", value: SubscriptionHubSelection): void;
  (e: "manage"): void;
  (e: "retry"): void;
}>();
const sidebarRef = ref<HTMLElement | null>(null);
const scrollProgress = ref(0);
const isFixedType = computed(() => props.fixedType !== null);
const typeNodes = computed(() =>
  props.tree.types.filter(
    (node) => !props.fixedType || node.subscription_type === props.fixedType,
  ),
);
const sources = (node: SubscriptionHubTypeNode) =>
  node.groups.flatMap((group) => group.memberships);
const sourceRows = computed(() =>
  typeNodes.value.flatMap((node) =>
    sources(node).map((membership) => ({
      membership,
      subscriptionType: node.subscription_type,
    })),
  ),
);
const shouldRender = computed(
  () =>
    !isFixedType.value ||
    props.loading ||
    !!props.error ||
    sourceRows.value.length > 0,
);
const title = (item: SubscriptionHubMembership) =>
  item.title || item.feed_source?.title || "未命名订阅";
const avatar = (item: SubscriptionHubMembership) =>
  item.feed_source?.cover_url ||
  (item.feed_source?.source_type === "external_rss"
    ? buildSourceFaviconURL(item.feed_source.rss_url)
    : "");
const unread = (item: SubscriptionHubMembership) => item.unread_count ?? 0;
const sourceType = (
  item: SubscriptionHubMembership,
  type: SubscriptionHubType,
) =>
  type === "podcast"
    ? "播客"
    : item.feed_source?.source_type === "internal_user"
      ? "账号"
      : item.feed_source?.source_type === "external_rss"
        ? "RSS"
        : "频道";
const updateScrollProgress = () => {
  const el = sidebarRef.value;
  if (el)
    scrollProgress.value =
      el.scrollHeight > el.clientHeight
        ? el.scrollTop / (el.scrollHeight - el.clientHeight)
        : 0;
};
</script>

<style scoped>
.subscription-hub-sidebar {
  position: relative;
  display: grid;
  gap: 0.5rem;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding: 0.75rem 0.7rem;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}
.subscription-hub-sidebar::after {
  position: absolute;
  top: 0;
  right: 0;
  width: 2px;
  height: calc(3rem + (100% - 3rem) * var(--scroll-progress));
  background: var(--a-color-primary);
  content: "";
  pointer-events: none;
}
.subscription-hub-sidebar.is-collapsed {
  padding: 0;
}
.subscription-hub-sidebar__header {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
}
.subscription-hub-sidebar__header p {
  margin: 0;
  color: var(--a-color-muted);
  font-weight: 650;
}
.subscription-hub-sidebar__header button {
  display: grid;
  width: 2.75rem;
  min-height: 2.75rem;
  place-items: center;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.subscription-hub-sidebar__skeleton,
.subscription-hub-sidebar__list {
  display: grid;
  gap: 0.25rem;
}
.subscription-hub-sidebar__skeleton span {
  height: 3rem;
}
.subscription-hub-sidebar__error {
  display: flex;
  justify-content: space-between;
  color: var(--a-color-danger);
}
.subscription-hub-sidebar__error button {
  border: 0;
  background: var(--a-color-surface-muted);
  color: inherit;
  cursor: pointer;
}
.subscription-hub-sidebar__source {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.subscription-hub-sidebar__source {
  display: grid;
  grid-template-columns: 2.25rem 1.7rem minmax(0, 1fr) auto;
  min-height: 3rem;
  align-items: center;
  gap: 0.38rem;
  padding: 0 0.6rem;
  font-size: 0.78rem;
}
.subscription-hub-sidebar__source:hover,
.subscription-hub-sidebar__source:focus-visible,
.subscription-hub-sidebar__source.is-active {
  background: var(--a-color-surface-muted);
  outline: 0;
}
.subscription-hub-sidebar__source > span:first-child {
  color: var(--a-color-muted);
  font-size: 0.72rem;
}
.subscription-hub-sidebar__name {
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.subscription-hub-sidebar__source > span:last-child {
  color: var(--a-color-primary);
  font-variant-numeric: tabular-nums;
}
.subscription-hub-sidebar__source > span:last-child.is-zero {
  color: var(--a-color-muted);
}
@media (prefers-reduced-motion: reduce) {
  .subscription-hub-sidebar::after {
    transition: none;
  }
}
</style>
