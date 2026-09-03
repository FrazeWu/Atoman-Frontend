<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ModuleSearch from '@/components/search/ModuleSearch.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import type { ReferenceTarget } from '@/api/references'
import { modulePathUrl } from '@/router/siteUrls'

const router = useRouter()
const query = ref('')

function openVideo(target: ReferenceTarget) {
  void router.push(modulePathUrl('video', target.path))
}
</script>

<template>
  <div class="a-page-md video-search-view">
    <PPageHeader title="搜索" mb="1.25rem" />
    <ModuleSearch
      v-model="query"
      :target-types="['video']"
      placeholder="搜索视频"
      input-test-id="video-search-input"
      dropdown-test-id="video-search-dropdown"
      @select="openVideo"
    />
  </div>
</template>

<style scoped>
.video-search-view { min-height: 100%; padding-bottom: 3rem; }
</style>
