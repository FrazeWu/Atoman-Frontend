<template>
  <main class="setting-feed-sources-view">
    <APageHeader
      title="来源管理"
      sub="用于后台查看订阅源 provider、来源类型、健康状态与基础隐藏/删除操作。当前仅提供前端骨架，待后端接口接通后可实际使用。"
      kicker="04 / SOURCES"
      accent
    />

    <AEmpty
      v-if="!authStore.isAuthenticated || !isAdminRole(authStore.user?.role)"
      title="仅管理员可访问"
      description="请使用管理员账号进入该后台来源管理页。"
    />

    <AEmpty
      v-else-if="store.error && !store.loading && !store.sources.length"
      title="来源列表暂不可用"
      :description="store.error"
    />

    <section v-else class="setting-feed-sources-view__section">
      <div class="setting-feed-sources-view__toolbar">
        <p class="setting-feed-sources-view__hint">展示字段：标题、provider、source_type、health_status、last_fetched_at、hidden 状态。</p>
      </div>

      <div v-if="store.loading" class="setting-feed-sources-view__skeletons" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="setting-feed-sources-view__skeleton" />
      </div>

      <AEmpty
        v-else-if="!store.sources.length"
        title="暂无来源数据"
        description="后端接口尚未实现或当前没有可展示的订阅源。"
      />

      <div v-else class="setting-feed-sources-view__list">
        <PaperEntry
          v-for="source in store.sources"
          :key="source.id"
          :title="source.title || source.rss_url || source.site_url || '未命名来源'"
          :summary="source.rss_url || source.site_url || source.canonical_url || '暂无来源地址'"
          badge="SRC"
        >
          <template #meta>
            <span>{{ source.provider }}</span>
            <span>{{ source.source_type }}</span>
            <span>{{ source.health_status }}</span>
            <span>{{ formatLastFetchedAt(source.last_fetched_at) }}</span>
          </template>

          <template #actions>
            <PaperClip
              :label="source.hidden ? '已隐藏' : '显示中'"
              :active="source.hidden"
              :disabled="busyIds.has(source.id)"
              @click="toggleHidden(source)"
            />
            <PaperReject
              label="删除"
              :disabled="busyIds.has(source.id)"
              @click="removeSource(source.id)"
            />
          </template>
        </PaperEntry>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AEmpty from '@/components/ui/AEmpty.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import { useAdminFeedSourcesStore } from '@/stores/adminFeedSources'
import { useAuthStore } from '@/stores/auth'
import type { AdminFeedSourceRow } from '@/types'
import { isAdminRole } from '@/utils/roles'

const authStore = useAuthStore()
const store = useAdminFeedSourcesStore()
const busyIds = ref(new Set<string>())

function markBusy(sourceId: string, nextBusy: boolean) {
  const next = new Set(busyIds.value)
  if (nextBusy) {
    next.add(sourceId)
  } else {
    next.delete(sourceId)
  }
  busyIds.value = next
}

function formatLastFetchedAt(value?: string) {
  return value || '未抓取'
}

async function refresh() {
  if (!authStore.isAuthenticated || !isAdminRole(authStore.user?.role)) return
  await store.fetchSources(authStore.token)
}

async function toggleHidden(source: AdminFeedSourceRow) {
  markBusy(source.id, true)
  try {
    const ok = await store.updateSource(source.id, { hidden: !source.hidden }, authStore.token)
    if (ok) {
      await refresh()
    }
  } finally {
    markBusy(source.id, false)
  }
}

async function removeSource(sourceId: string) {
  markBusy(sourceId, true)
  try {
    const ok = await store.deleteSource(sourceId, authStore.token)
    if (ok) {
      await refresh()
    }
  } finally {
    markBusy(sourceId, false)
  }
}

onMounted(() => {
  void refresh()
})
</script>

<style scoped>
.setting-feed-sources-view {
  display: grid;
  gap: 1.5rem;
}

.setting-feed-sources-view__section {
  display: grid;
  gap: 1rem;
}

.setting-feed-sources-view__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.setting-feed-sources-view__hint {
  margin: 0;
  color: var(--a-color-ink-muted);
  font-size: var(--a-text-sm);
  line-height: 1.6;
}

.setting-feed-sources-view__skeletons {
  display: grid;
  gap: 0.75rem;
}

.setting-feed-sources-view__skeleton {
  height: 7.5rem;
  border: 1px solid var(--a-color-line-soft);
  background:
    linear-gradient(90deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.09) 50%, rgba(15, 23, 42, 0.05) 100%);
  background-size: 200% 100%;
  animation: feed-source-skeleton 1.4s ease-in-out infinite;
}

.setting-feed-sources-view__list {
  display: grid;
}

@keyframes feed-source-skeleton {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 720px) {
  .setting-feed-sources-view__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
