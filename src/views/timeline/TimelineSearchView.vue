<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ModuleSearch from '@/components/search/ModuleSearch.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import type { ReferenceTarget } from '@/api/references'
import { modulePathUrl } from '@/router/siteUrls'

const router = useRouter()
const query = ref('')

function openTarget(target: ReferenceTarget) {
  void router.push(modulePathUrl('timeline', target.path))
}
</script>

<template>
  <div class="a-page-md timeline-search-view">
    <PPageHeader title="搜索" mb="1.25rem" />
    <ModuleSearch
      v-model="query"
      :target-types="['person', 'event']"
      placeholder="搜索人物或历史事件"
      input-test-id="timeline-search-input"
      dropdown-test-id="timeline-search-dropdown"
      @select="openTarget"
    />
  </div>
</template>

<style scoped>
.timeline-search-view { min-height: 100%; padding-bottom: 3rem; }
</style>
