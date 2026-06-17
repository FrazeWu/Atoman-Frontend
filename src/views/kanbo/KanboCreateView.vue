<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import KanboCollectionRail from '@/components/kanbo/KanboCollectionRail.vue'
import KanboCollectionWorkspace from '@/components/kanbo/KanboCollectionWorkspace.vue'
import KanboMixedFeedSection from '@/components/kanbo/KanboMixedFeedSection.vue'
import KanboVideoCardSection from '@/components/kanbo/KanboVideoCardSection.vue'
import { useAuthStore } from '@/stores/auth'
import { useKanboChannel } from '@/composables/useKanboChannel'
import { useKanboCollections } from '@/composables/useKanboCollections'
import { useKanboOverview } from '@/composables/useKanboOverview'

const authStore = useAuthStore()
const { channels, currentKanboChannelId, switchChannel, loadChannels } = useKanboChannel()
const {
  collections,
  loadingCollections,
  selectedCollection,
  selectedCollectionId,
  loadCollections,
} = useKanboCollections()
const { mixedItems, videoItems, loadingOverview, loadOverview } = useKanboOverview()

const selectedChannel = computed(() =>
  channels.value.find(channel => channel.id === currentKanboChannelId.value) || null,
)
const authUserId = computed(() => authStore.user?.uuid ?? authStore.user?.id)

const publishPath = computed(() => {
  if (!selectedCollectionId.value) return ''
  const query = `channel=${currentKanboChannelId.value || ''}&collection=${selectedCollectionId.value}`
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
  await loadCollections(currentKanboChannelId.value)
  await loadOverview(currentKanboChannelId.value)
})

watch(currentKanboChannelId, channelId => {
  void loadCollections(channelId)
  void loadOverview(channelId)
})
</script>

<template>
  <div class="a-page">
    <PPageHeader title="创作" sub="在当前频道内统一管理文章、播客与视频。" accent>
      <template #action>
        <PButton
          data-testid="kanbo-publish-button"
          :to="publishPath || undefined"
          :disabled="!selectedCollectionId"
        >
          发布
        </PButton>
      </template>
    </PPageHeader>

    <div class="kanbo-toolbar">
      <label class="kanbo-label" for="kanbo-channel">频道</label>
      <select id="kanbo-channel" class="kanbo-select" :value="currentKanboChannelId || ''" @change="onChannelChange">
        <option value="">选择频道</option>
        <option v-for="channel in channels" :key="channel.id" :value="channel.id">
          {{ channel.name }}
        </option>
      </select>
    </div>

    <p v-if="!selectedCollectionId" class="a-muted">请先选择一个合集</p>
    <p v-if="selectedChannel" class="a-muted">当前频道：{{ selectedChannel.name }}</p>

    <KanboCollectionRail :items="collections" :loading="loadingCollections" />

    <KanboCollectionWorkspace v-if="selectedCollection" />

    <template v-else>
      <div v-if="loadingOverview" class="a-skeleton kanbo-skeleton" />
      <template v-else>
        <KanboMixedFeedSection :items="mixedItems" />
        <KanboVideoCardSection :items="videoItems" />
      </template>
    </template>
  </div>
</template>

<style scoped>
.kanbo-toolbar,
.kanbo-section-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.kanbo-label {
  font-weight: 800;
}

.kanbo-select {
  min-width: 12rem;
  border: 1px solid var(--a-color-line);
  padding: 0.45rem 0.65rem;
  background: var(--a-color-bg);
}

.kanbo-skeleton {
  height: 6rem;
  margin-top: 1.5rem;
}
</style>
