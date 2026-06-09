<template>
  <div class="a-page-xl feed-subpage">
    <APageHeader title="设置" accent sub="管理订阅体验与后续偏好选项">
      <template #action>
        <RouterLink to="/" style="text-decoration:none">
          <PaperPress variant="secondary" label="返回订阅" />
        </RouterLink>
      </template>
    </APageHeader>

    <div class="feed-timeline">
      <PaperEntry
        title="订阅设置即将到来"
        summary="我们正在重新设计设置面板，以提供更精细的过滤和偏好管理功能。当前版本专注于基础阅读体验的提升。"
      >
        <template #visual>
          <PaperBadge type="internal" :fill="true">COMING SOON</PaperBadge>
        </template>
        <template #meta>
          <span class="a-label a-muted">System</span>
          <span style="color:var(--a-color-muted-soft)">2026.05.29</span>
        </template>
      </PaperEntry>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperBadge from '@/components/ui/PaperBadge.vue'
</script>

<style scoped>
.feed-subpage {
  padding-bottom: 12rem;
}

.feed-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>

