<template>
  <div v-if="visible" class="module-create-action">
    <PButton :to="config.to" size="sm" :data-testid="`module-create-${module}`">
      <component :is="config.icon" :size="16" aria-hidden="true" />
      {{ config.label }}
    </PButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FilePenLine, Mic2, Upload } from 'lucide-vue-next'

import PButton from '@/components/ui/PButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import type { StudioModule } from '@/types'

const props = defineProps<{ module: StudioModule }>()
const authStore = useAuthStore()
const siteAccess = useSiteAccessStore()

const configs = {
  blog: { label: '写博客', to: '/studio/blog/new', feature: 'post.create', icon: FilePenLine },
  podcast: { label: '上传播客', to: '/studio/podcast/new', feature: 'podcast.publish', icon: Mic2 },
  video: { label: '上传视频', to: '/studio/video/new', feature: 'video.publish', icon: Upload },
} as const

const config = computed(() => configs[props.module])
const visible = computed(() => (
  authStore.isAuthenticated
  && siteAccess.isFeatureEnabled(props.module, config.value.feature)
))
</script>

<style scoped>
.module-create-action {
  display: flex;
  justify-content: flex-end;
  min-height: 44px;
  margin-bottom: 1rem;
}

@media (max-width: 560px) {
  .module-create-action :deep(.p-button) {
    width: 100%;
  }
}
</style>
