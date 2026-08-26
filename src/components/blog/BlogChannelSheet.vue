<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Plus } from 'lucide-vue-next'

import { apiRequestResult } from '@/api/client'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useFeedStore } from '@/stores/feed'
import type { Channel, Post } from '@/types'
import type { BlogChannelLayer } from '@/components/blog/blogSheetTypes'

const props = withDefaults(defineProps<{
  layer: BlogChannelLayer
  layerIndex?: number
  stackSize?: number
}>(), {
  layerIndex: 0,
  stackSize: 1,
})

const api = useApi()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const sheets = useBlogSheets()
const channel = ref<Channel | null>(null)
const posts = ref<Post[]>([])
const loading = ref(false)
const errorMessage = ref('')
const subscribed = ref(false)
const subscribeLoading = ref(false)

const channelId = computed(() => props.layer.payload.channelId)
let loadSequence = 0

async function loadChannel() {
  const requestedChannelId = channelId.value
  const requestSequence = ++loadSequence
  loading.value = true
  errorMessage.value = ''
  channel.value = null
  posts.value = []
  subscribed.value = false
  try {
    const channelResponse = await apiRequestResult(api.blog.channel(requestedChannelId))
    if (requestSequence !== loadSequence || requestedChannelId !== channelId.value) return
    if (!channelResponse.ok) throw new Error('channel load failed')
    const channelPayload = await Promise.resolve(channelResponse.data)
    if (requestSequence !== loadSequence || requestedChannelId !== channelId.value) return
    channel.value = channelPayload.data || channelPayload
    const postResponse = await apiRequestResult(`${api.blog.posts}?channel_id=${encodeURIComponent(requestedChannelId)}&page=1&page_size=20`)
    if (requestSequence !== loadSequence || requestedChannelId !== channelId.value) return
    if (!postResponse.ok) throw new Error('post load failed')
    const postPayload = await Promise.resolve(postResponse.data)
    if (requestSequence !== loadSequence || requestedChannelId !== channelId.value) return
    posts.value = Array.isArray(postPayload.data) ? postPayload.data : []
    if (authStore.isAuthenticated && channel.value?.id) {
      const nextSubscribed = await feedStore.isSubscribedToChannel(channel.value.id)
      if (requestSequence !== loadSequence || requestedChannelId !== channelId.value) return
      subscribed.value = nextSubscribed
    }
  } catch {
    if (requestSequence !== loadSequence || requestedChannelId !== channelId.value) return
    channel.value = null
    posts.value = []
    errorMessage.value = '频道内容加载失败，请重试'
  } finally {
    if (requestSequence === loadSequence && requestedChannelId === channelId.value) loading.value = false
  }
}

async function toggleSubscribe() {
  if (!channel.value || !authStore.isAuthenticated || subscribeLoading.value) return
  subscribeLoading.value = true
  try {
    const success = subscribed.value
      ? await feedStore.unsubscribeFromChannel(channel.value.id)
      : await feedStore.subscribeToChannel(channel.value.id)
    if (success) subscribed.value = !subscribed.value
  } finally {
    subscribeLoading.value = false
  }
}

watch(channelId, () => void loadChannel(), { immediate: true })
</script>

<template>
  <PSheet
    :show="sheets.isActive(layer.key)"
    :title="channel?.name || layer.title"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key)"
    :is-top-layer="sheets.isTop(layer.key)"
    close-type="both"
    @close="sheets.closeLayer(layer.key)"
    @activate="sheets.returnToLayer(layer.key)"
  >
    <div v-if="loading" class="channel-sheet-loading" aria-label="正在加载频道">
      <div class="a-skeleton channel-sheet-visual-skeleton" />
      <div v-for="index in 5" :key="index" class="a-skeleton channel-sheet-line-skeleton" />
    </div>
    <PEmpty v-else-if="errorMessage" title="加载失败" :description="errorMessage">
      <template #action>
        <PButton variant="secondary" size="sm" @click="loadChannel">重试</PButton>
      </template>
    </PEmpty>
    <article v-else-if="channel" class="channel-sheet">
      <div class="channel-sheet-visual">
        <img v-if="channel.cover_url" :src="channel.cover_url" :alt="channel.name" />
        <span v-else aria-hidden="true">{{ channel.name.slice(0, 1).toUpperCase() }}</span>
      </div>
      <div class="channel-sheet-heading">
        <div>
          <p class="a-label a-muted">频道</p>
          <h1>{{ channel.name }}</h1>
          <p v-if="channel.description" class="channel-sheet-description">{{ channel.description }}</p>
        </div>
        <PButton
          v-if="authStore.isAuthenticated"
          :variant="subscribed ? 'secondary' : 'primary'"
          :disabled="subscribeLoading"
          @click="toggleSubscribe"
        >
          <Check v-if="subscribed" :size="15" aria-hidden="true" />
          <Plus v-else :size="15" aria-hidden="true" />
          {{ subscribed ? '已订阅' : '订阅频道' }}
        </PButton>
      </div>
      <div v-if="!posts.length" class="channel-sheet-empty">
        <PEmpty title="暂无文章" description="该频道还没有已发布文章" />
      </div>
      <div v-else class="channel-sheet-posts">
        <BlogItemCard
          v-for="post in posts"
          :key="post.id"
          :item="post"
          type="post"
          :bookmarked="feedStore.bookmarkedPostIds.has(post.id)"
          :in-reading-list="feedStore.readingListItemIds.has(post.id)"
          @click="sheets.openPost(post.id, post.title)"
          @toggle-bookmark="feedStore.togglePostBookmark(post.id)"
          @toggle-reading-list="feedStore.toggleReadingListItem(post.id)"
        />
      </div>
    </article>
  </PSheet>
</template>

<style scoped>
.channel-sheet-loading,
.channel-sheet {
  padding: 1.5rem 1.25rem 5rem;
}

.channel-sheet-visual,
.channel-sheet-visual-skeleton {
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.channel-sheet-visual {
  display: grid;
  place-items: center;
  color: var(--a-color-muted);
  font-size: 3rem;
  font-weight: 650;
}

.channel-sheet-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.channel-sheet-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.25rem 0 1.5rem;
}

.channel-sheet-heading h1 {
  margin: 0.25rem 0 0;
  font-size: 1.5rem;
}

.channel-sheet-description {
  max-width: 48rem;
  margin: 0.5rem 0 0;
  color: var(--a-color-muted);
  line-height: 1.55;
}

.channel-sheet-posts {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.channel-sheet-line-skeleton {
  height: 1rem;
  margin-top: 0.75rem;
}

@media (max-width: 640px) {
  .channel-sheet-heading {
    flex-direction: column;
  }
}
</style>
