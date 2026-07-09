<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

type SubscriptionVideo = {
  id: string
  title: string
  channel?: { id: string; name: string }
  collections?: Array<{ id: string; name: string }>
  updated_at?: string
  created_at?: string
  view_count?: number
}

type SourceBookmark = {
  id: string
  channel?: { id: string; name: string }
  collection?: { id: string; name: string }
}

const api = useApi()
const authStore = useAuthStore()
const videos = ref<SubscriptionVideo[]>([])
const channelBookmarks = ref<SourceBookmark[]>([])
const collectionBookmarks = ref<SourceBookmark[]>([])
const loading = ref(false)
const errorMessage = ref('')

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${api.url}${path}`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (!res.ok) throw new Error('load failed')
  const payload = await res.json()
  return (payload.data ?? payload) as T
}

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [videoItems, channelItems, collectionItems] = await Promise.all([
      fetchJson<SubscriptionVideo[]>('/videos/subscriptions'),
      fetchJson<SourceBookmark[]>('/videos/channel-bookmarks'),
      fetchJson<SourceBookmark[]>('/videos/collection-bookmarks'),
    ])
    videos.value = videoItems
    channelBookmarks.value = channelItems
    collectionBookmarks.value = collectionItems
  } catch {
    errorMessage.value = '订阅加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="a-page-xl video-subscriptions-view">
    <PPageHeader
      title="订阅"
      accent
    />

    <p v-if="loading" class="video-subscriptions-state">正在加载...</p>
    <p v-else-if="errorMessage" class="video-subscriptions-state video-subscriptions-state--error">{{ errorMessage }}</p>
    <PEmpty v-else-if="!videos.length" title="暂无订阅更新" />

    <div v-else class="video-subscriptions-content">
      <aside class="video-subscriptions-sources" aria-label="订阅来源">
        <section v-if="channelBookmarks.length">
          <h2>频道</h2>
          <RouterLink
            v-for="item in channelBookmarks"
            :key="item.id"
            :to="`/channel/${item.channel?.id}`"
          >
            {{ item.channel?.name }}
          </RouterLink>
        </section>

        <section v-if="collectionBookmarks.length">
          <h2>合集</h2>
          <RouterLink
            v-for="item in collectionBookmarks"
            :key="item.id"
            :to="`/videos/collections/${item.collection?.id}`"
          >
            {{ item.collection?.name }}
          </RouterLink>
        </section>
      </aside>

      <main class="video-subscriptions-list" aria-label="订阅更新">
        <article
          v-for="item in videos"
          :key="item.id"
          class="video-subscription-item"
        >
          <RouterLink :to="`/videos/watch/${item.id}`" class="video-subscription-item__title">
            {{ item.title }}
          </RouterLink>
          <div class="video-subscription-item__meta">
            <span v-if="item.channel">{{ item.channel.name }}</span>
            <span v-for="collection in item.collections" :key="collection.id">{{ collection.name }}</span>
          </div>
        </article>
      </main>
    </div>
  </div>
</template>

<style scoped>
.video-subscriptions-view {
  min-height: 100%;
}

.video-subscriptions-state {
  margin: 1.5rem 0 0;
  color: var(--a-color-muted);
}

.video-subscriptions-state--error {
  color: #8a2f2f;
}

.video-subscriptions-content {
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.video-subscriptions-sources {
  display: grid;
  align-content: start;
  gap: 1rem;
}

.video-subscriptions-sources section,
.video-subscriptions-list {
  display: grid;
  gap: 0.65rem;
}

.video-subscriptions-sources h2 {
  margin: 0;
  font-size: 0.8rem;
  color: var(--a-color-muted);
}

.video-subscriptions-sources a,
.video-subscription-item__title {
  color: var(--a-color-fg);
  text-decoration: none;
  font-weight: 700;
}

.video-subscription-item {
  display: grid;
  gap: 0.4rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--a-color-line-soft);
}

.video-subscription-item__meta {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

@media (max-width: 720px) {
  .video-subscriptions-content {
    grid-template-columns: 1fr;
  }
}
</style>
