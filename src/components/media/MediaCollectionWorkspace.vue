<template>
  <section class="media-workspace a-card-sm">
    <div v-if="activeCollection?.type === 'article'">
      <h2>文章工作区</h2>
      <p class="a-muted">当前合集：{{ activeCollection.name }}</p>
      <div class="workspace-actions">
        <PButton v-if="articleCreatePath" :to="articleCreatePath" size="sm">写文章</PButton>
      </div>
    </div>
    <div v-else-if="activeCollection?.type === 'podcast'">
      <h2>播客工作区</h2>
      <p class="a-muted">当前合集：{{ activeCollection.name }}</p>
      <div class="workspace-actions">
        <PButton v-if="podcastEditorPath" :to="podcastEditorPath" size="sm">发布单集</PButton>
      </div>
    </div>
    <div v-else-if="activeCollection?.type === 'video'">
      <h2>视频工作区</h2>
      <p class="a-muted">当前合集：{{ activeCollection.name }}</p>
      <div class="workspace-actions">
        <PButton v-if="videoUploadPath" :to="videoUploadPath" size="sm">上传视频</PButton>
        <PButton v-if="videoManagePath" :to="videoManagePath" variant="ghost" size="sm">管理视频</PButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import { useMediaCollections } from '@/composables/useMediaCollections'
import { modulePathUrl } from '@/router/siteUrls'

const props = defineProps<{
  channelId?: string | null
}>()

const { selectedCollection } = useMediaCollections()
const activeCollection = computed(() => selectedCollection.value)

const workspaceQuery = computed(() => {
  if (!props.channelId || !activeCollection.value?.id) return ''
  return new URLSearchParams({
    channel: props.channelId,
    collection: activeCollection.value.id,
  }).toString()
})

const articleCreatePath = computed(() => (
  workspaceQuery.value ? `${modulePathUrl('blog', '/post/new')}?${workspaceQuery.value}` : ''
))
const podcastEditorPath = computed(() => (
  workspaceQuery.value ? `${modulePathUrl('podcast', '/editor')}?${workspaceQuery.value}` : ''
))
const videoUploadPath = computed(() => (
  workspaceQuery.value ? `${modulePathUrl('video', '/upload')}?${workspaceQuery.value}` : ''
))
const videoManagePath = computed(() => (
  workspaceQuery.value ? `${modulePathUrl('video', '/manage')}?${workspaceQuery.value}` : ''
))
</script>

<style scoped>
.workspace-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
