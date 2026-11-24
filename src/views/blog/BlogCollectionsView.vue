<template>
  <div class="a-page-xl blog-collections-page">
    <!-- Page Header (Apple Cupertino Editorial Style) -->
    <PPageHeader
      title="合集"
      accent
      sub="探索专题专栏与深度系列内容"
      mb="1.25rem"
    />

    <!-- Filter & Search Toolbar -->
    <div class="collections-toolbar">
      <div class="collections-search">
        <PInput
          v-model="searchQuery"
          placeholder="搜索专栏合集..."
          size="sm"
          clearable
        />
      </div>

      <div v-if="channelFilterOptions.length > 1" class="collections-channel-select">
        <PSelect
          v-model="selectedChannelId"
          :options="channelFilterOptions"
          label="所属频道"
          size="sm"
        />
      </div>
    </div>

    <!-- 1px Subtle Hairline Rule -->
    <div class="collections-divider" />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="collections-skeleton-grid">
      <div v-for="index in 4" :key="index" class="a-skeleton collections-skeleton-card" />
    </div>

    <!-- Error State -->
    <PEmpty v-else-if="error" title="合集加载失败" :description="error">
      <template #action>
        <PButton variant="secondary" size="sm" @click="fetchCollections">重试</PButton>
      </template>
    </PEmpty>

    <!-- Empty State -->
    <PEmpty
      v-else-if="filteredCollections.length === 0"
      title="暂无专栏合集"
      :description="searchQuery ? '未找到匹配的合集' : '当前暂无公开的专栏合集'"
    />

    <!-- Collections List Grid -->
    <div v-else class="collections-grid">
      <article
        v-for="item in filteredCollections"
        :key="item.id"
        class="collection-entry-card"
        tabindex="0"
        role="button"
        @click="goToCollection(item.id)"
        @keydown.enter="goToCollection(item.id)"
      >
        <div class="collection-entry-header">
          <div class="collection-badge-icon" aria-hidden="true">
            <Layers :size="16" />
          </div>
          <div class="collection-entry-titles">
            <h2 class="collection-entry-name">
              {{ item.name }}
            </h2>
            <div v-if="item.channel" class="collection-entry-channel">
              <span class="channel-label-text">频道：</span>
              <RouterLink
                :to="`/posts/channel/${item.channel.slug || item.channel.id}`"
                class="channel-nav-pill"
                @click.stop
              >
                <span>{{ item.channel.name }}</span>
                <ArrowUpRight :size="11" class="channel-nav-arrow" aria-hidden="true" />
              </RouterLink>
            </div>
          </div>
        </div>

        <p v-if="item.description" class="collection-entry-desc">
          {{ item.description }}
        </p>
        <p v-else class="collection-entry-desc is-empty">
          暂无描述
        </p>

        <div class="collection-entry-footer">
          <span v-if="item.is_default" class="default-badge">默认专栏</span>
          <span class="collection-view-link">
            浏览文章 <ArrowUpRight :size="12" aria-hidden="true" />
          </span>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowUpRight, Layers } from 'lucide-vue-next'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { reportError } from '@/utils/logger'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import type { Channel, Collection } from '@/types'

interface AugmentedCollection extends Collection {
  channel?: Channel
}

const router = useRouter()
const api = useApi()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')
const collections = ref<AugmentedCollection[]>([])
const searchQuery = ref('')
const selectedChannelId = ref('')
const channels = ref<Channel[]>([])

const channelFilterOptions = computed(() => [
  { label: '全部频道', value: '' },
  ...channels.value.map(ch => ({ label: ch.name, value: ch.id })),
])

const filteredCollections = computed(() => {
  let list = collections.value

  if (selectedChannelId.value) {
    list = list.filter(c => c.channel_id === selectedChannelId.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.channel && c.channel.name.toLowerCase().includes(q)),
    )
  }

  return list
})

const goToCollection = (id: string | number) => {
  void router.push(`/posts/collection/${id}`)
}

const fetchCollections = async () => {
  loading.value = true
  error.value = ''
  try {
    // 1. Fetch all blog channels
    const channelsRes = await apiRequestResult(api.blog.channels)
    const channelList: Channel[] = Array.isArray(channelsRes.data?.data)
      ? channelsRes.data.data
      : (Array.isArray(channelsRes.data) ? channelsRes.data : [])
    channels.value = channelList

    // 2. Map channel ID to channel info
    const channelMap = new Map<string, Channel>()
    channelList.forEach(ch => channelMap.set(ch.id, ch))

    // 3. Fetch collections for channels in parallel
    const collectionPromises: Promise<AugmentedCollection[]>[] = channelList.map(async (ch): Promise<AugmentedCollection[]> => {
      try {
        const res = await apiRequestResult(api.blog.channelCollections(ch.id))
        const items: Collection[] = Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data) ? res.data : [])
        return items.map(c => ({ ...c, channel: ch }))
      } catch {
        return []
      }
    })

    // If logged in, also fetch user's collections
    if (authStore.isAuthenticated) {
      collectionPromises.push(
        (async (): Promise<AugmentedCollection[]> => {
          try {
            const res = await apiRequestResult(api.blog.collections)
            const items: Collection[] = Array.isArray(res.data?.data)
              ? res.data.data
              : (Array.isArray(res.data) ? res.data : [])
            return items.map(c => ({
              ...c,
              channel: c.channel_id ? channelMap.get(c.channel_id) : undefined,
            }))
          } catch {
            return []
          }
        })(),
      )
    }

    const results = await Promise.all(collectionPromises)
    const allCollections = results.flat()

    // Deduplicate by ID
    const uniqueMap = new Map<string, AugmentedCollection>()
    for (const c of allCollections) {
      if (c.id && !uniqueMap.has(String(c.id))) {
        uniqueMap.set(String(c.id), c)
      }
    }

    // Sort: Non-default collections with description first, then default
    collections.value = Array.from(uniqueMap.values()).sort((a, b) => {
      if (!a.is_default && b.is_default) return -1
      if (a.is_default && !b.is_default) return 1
      return (b.name || '').localeCompare(a.name || '')
    })
  } catch (err) {
    reportError(err)
    error.value = '加载专栏合集失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchCollections()
})
</script>

<style scoped>
.blog-collections-page {
  padding-bottom: 3rem;
}

.collections-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.collections-search {
  flex: 1;
  min-width: 14rem;
  max-width: 24rem;
}

.collections-channel-select {
  width: 12rem;
}

/* 贯穿细横线：与频道主页、专栏合集页完全一致的极简质感分割 */
.collections-divider {
  width: 100%;
  height: 1px;
  background-color: var(--a-color-border-soft, #f0f0f0);
  margin-bottom: 1.5rem;
}

.collections-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1rem;
}

.collections-skeleton-card {
  height: 9rem;
  border-radius: var(--a-radius-card, 4px);
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1.25rem;
}

.collection-entry-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.15rem 1.25rem;
  border-radius: var(--a-radius-card, 4px);
  border: 1px solid var(--a-color-border-soft, #f0f0f0);
  background-color: var(--a-color-bg);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  min-height: 8.5rem;
  outline: none;
}

.collection-entry-card:hover,
.collection-entry-card:focus-visible {
  border-color: var(--a-color-primary, #0071e3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}

.collection-entry-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.collection-badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--a-radius-control, 4px);
  background-color: var(--a-color-surface-soft, rgba(0, 113, 227, 0.08));
  color: var(--a-color-primary, #0071e3);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.collection-entry-titles {
  flex: 1;
  min-width: 0;
}

.collection-entry-name {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--a-color-text, #1d1d1f);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-entry-card:hover .collection-entry-name {
  color: var(--a-color-primary, #0071e3);
}

.collection-entry-channel {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.channel-label-text {
  color: var(--a-color-muted, #86868b);
  font-size: 0.78rem;
}

.channel-nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.12rem 0.45rem;
  border-radius: var(--a-radius-control, 4px);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--a-color-primary, #0071e3);
  background-color: var(--a-color-surface-soft, rgba(0, 113, 227, 0.08));
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.channel-nav-pill:hover {
  opacity: 0.8;
}

.channel-nav-arrow {
  opacity: 0.7;
}

.collection-entry-desc {
  margin: 0.65rem 0 0.85rem;
  font-size: 0.85rem;
  color: var(--a-color-muted, #86868b);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-entry-desc.is-empty {
  font-style: italic;
  opacity: 0.6;
}

.collection-entry-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft, #f0f0f0);
  font-size: 0.78rem;
}

.default-badge {
  color: var(--a-color-muted, #86868b);
}

.collection-view-link {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--a-color-primary, #0071e3);
  font-weight: 500;
  margin-left: auto;
}
</style>
