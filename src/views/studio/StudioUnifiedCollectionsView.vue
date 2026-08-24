<template>
  <section class="studio-unified-collections">
    <PPageHeader title="合集" sub="按专题整理当前频道的内容。" mb="0" />

    <p v-if="loading" class="studio-unified-collections__message">加载中...</p>
    <p v-else-if="error" class="studio-unified-collections__message studio-unified-collections__message--error" role="alert">
      {{ error }}
    </p>
    <PEmpty v-else-if="!studio.currentChannel" kicker="" title="请先创建频道" description="合集需要归属于一个频道。">
      <template #action>
        <RouterLink class="studio-unified-collections__channel-link" to="/studio/manage/channel">管理频道</RouterLink>
      </template>
    </PEmpty>
    <StudioCollectionManager v-else />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { RouterLink } from 'vue-router'

import StudioCollectionManager from '@/components/studio/StudioCollectionManager.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()
const loading = ref(true)
const error = ref('')

let latestRequest = 0

async function loadCollections() {
  const request = ++latestRequest
  loading.value = true
  error.value = ''
  try {
    await studio.loadState()
    if (studio.currentChannel) await studio.loadUnifiedCollections()
  } catch (cause) {
    if (request === latestRequest) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

onMounted(loadCollections)
</script>

<style scoped>
.studio-unified-collections { display: grid; gap: 1.5rem; max-width: 60rem; }
.studio-unified-collections__message { margin: 0; padding: 2rem 0; color: var(--a-color-muted); }
.studio-unified-collections__message--error { color: var(--a-color-danger); }
.studio-unified-collections__channel-link { min-height: 2.75rem; display: inline-flex; align-items: center; padding: 0 0.875rem; border: 1px solid var(--a-color-primary); border-radius: var(--a-radius-control); background: var(--a-color-primary); color: var(--a-color-primary-contrast); text-decoration: none; }
.studio-unified-collections__channel-link:hover { background: var(--a-color-primary-hover); }
</style>
