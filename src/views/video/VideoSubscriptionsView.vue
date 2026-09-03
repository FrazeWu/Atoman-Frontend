<script setup lang="ts">
import { computed } from 'vue'

import ModuleSubscriptionSourcesPicker from '@/components/feed/ModuleSubscriptionSourcesPicker.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { useModuleSubscriptionTimeline } from '@/composables/feed/useModuleSubscriptionTimeline'
import { useAuthStore } from '@/stores/auth'
import type { Video } from '@/types'

const authStore = useAuthStore()
const timeline = useModuleSubscriptionTimeline('video')
const videos = computed(() => timeline.items.value
  .filter((item) => item.type === 'video' && item.video)
  .map((item) => item.video as Video))
const pageMeta = computed(() => ({
  page: timeline.page.value,
  page_size: timeline.pageSize,
  total: timeline.total.value,
  has_more: timeline.hasMore.value,
}))
</script>

<template>
  <div class="a-page-xl video-subscriptions-view">
    <ModuleSubscriptionSourcesPicker subscription-type="video" subscription-path="/videos/subscriptions" />
    <PPageHeader title="视频订阅" mb="1.25rem" />

    <div v-if="!authStore.isAuthenticated" class="video-subscriptions-unauth">
      <PEmpty title="请登录后查看视频订阅" description="登录账号以同步你订阅的频道与合集更新。">
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <p v-if="timeline.loading.value && !videos.length" class="video-subscriptions-state">正在加载...</p>
      <PEmpty v-else-if="timeline.error.value && !videos.length" title="订阅内容加载失败">
        <template #action>
          <button type="button" class="a-btn" @click="timeline.retry">重试</button>
        </template>
      </PEmpty>
      <PEmpty v-else-if="!videos.length" title="暂无订阅更新" description="有新视频时会显示在这里。" />
      <main v-else class="video-subscriptions-list" aria-label="订阅更新">
        <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
      </main>
      <PaginationBar :meta="pageMeta" :loading="timeline.loading.value" @change="timeline.changePage" />
    </template>
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

.video-subscriptions-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}
</style>
