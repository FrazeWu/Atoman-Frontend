<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import MediaCollectionRail from '@/components/media/MediaCollectionRail.vue'
import MediaCollectionWorkspace from '@/components/media/MediaCollectionWorkspace.vue'
import MediaMixedFeedSection from '@/components/media/MediaMixedFeedSection.vue'
import MediaVideoCardSection from '@/components/media/MediaVideoCardSection.vue'
import { useAuthStore } from '@/stores/auth'
import { useMediaChannel } from '@/composables/useMediaChannel'
import { useMediaCollections } from '@/composables/useMediaCollections'
import { useMediaOverview } from '@/composables/useMediaOverview'

const authStore = useAuthStore()
const { channels, currentMediaChannelId, switchChannel, loadChannels } = useMediaChannel()
const {
  collections,
  loadingCollections,
  selectedCollection,
  selectedCollectionId,
  loadCollections,
} = useMediaCollections()
const { mixedItems, videoItems, loadingOverview, loadOverview } = useMediaOverview()

const selectedChannel = computed(() =>
  channels.value.find(channel => channel.id === currentMediaChannelId.value) || null,
)
const authUserId = computed(() => authStore.user?.uuid ?? authStore.user?.id)

const publishPath = computed(() => {
  if (!selectedCollectionId.value) return ''
  const query = `channel=${currentMediaChannelId.value || ''}&collection=${selectedCollectionId.value}`
  if (selectedCollection.value?.type === 'podcast') return `/editor?${query}&site=podcast`
  if (selectedCollection.value?.type === 'video') return `/upload?${query}&site=video`
  return `/post/new?${query}&site=blog`
})

const onChannelChange = async (event: Event) => {
  const channelId = (event.target as HTMLSelectElement).value || null
  await switchChannel(channelId, authStore.token)
  await loadCollections(channelId)
  await loadOverview(channelId)
}

onMounted(async () => {
  await loadChannels(authStore.token, authUserId.value)
  await loadCollections(currentMediaChannelId.value)
  await loadOverview(currentMediaChannelId.value)
})

watch(currentMediaChannelId, channelId => {
  void loadCollections(channelId)
  void loadOverview(channelId)
})
</script>

<template>
  <div class="a-page">
    <PPageHeader title="创作" sub="在当前频道内统一管理文章、播客与视频。" accent>
      <template #action>
        <PButton
          data-testid="media-publish-button"
          :to="publishPath || undefined"
          :disabled="!selectedCollectionId"
        >
          发布
        </PButton>
      </template>
    </PPageHeader>

    <div class="media-toolbar">
      <label class="media-label" for="media-channel">频道</label>
      <select id="media-channel" class="media-select" :value="currentMediaChannelId || ''" @change="onChannelChange">
        <option value="">选择频道</option>
        <option v-for="channel in channels" :key="channel.id" :value="channel.id">
          {{ channel.name }}
        </option>
      </select>
    </div>

    <p v-if="!selectedCollectionId" class="a-muted">请先选择一个合集</p>
    <p v-if="selectedChannel" class="a-muted">当前频道：{{ selectedChannel.name }}</p>

    <MediaCollectionRail :items="collections" :loading="loadingCollections" />

    <MediaCollectionWorkspace v-if="selectedCollection" />

    <template v-else>
      <div v-if="loadingOverview" class="a-skeleton media-skeleton" />
      <template v-else>
        <MediaMixedFeedSection :items="mixedItems" />
        <MediaVideoCardSection :items="videoItems" />
      </template>
    </template>
  </div>
</template>

<style scoped>
.media-toolbar,
.media-section-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.media-label {
  font-weight: 800;
}

.media-select {
  min-width: 12rem;
  border: 1px solid var(--a-color-line);
  padding: 0.45rem 0.65rem;
  background: var(--a-color-bg);
}

.media-skeleton {
  height: 6rem;
  margin-top: 1.5rem;
}
</style>
