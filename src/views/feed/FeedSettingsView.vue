<template>
  <div class="a-page-xl feed-subpage">
    <PPageHeader title="设置" accent sub="管理订阅体验与后续偏好选项">
      <template #action>
        <RouterLink to="/feed" style="text-decoration:none">
          <PPress variant="secondary" label="返回订阅" />
        </RouterLink>
      </template>
    </PPageHeader>

    <div class="feed-timeline">
      <PEntry
        title="订阅设置即将到来"
        summary="我们正在重新设计设置面板，以提供更精细的过滤和偏好管理功能。当前版本专注于基础阅读体验的提升。"
      >
        <template #visual>
          <PBadge type="internal" :fill="true">COMING SOON</PBadge>
        </template>
        <template #meta>
          <span class="a-label a-muted">System</span>
          <span style="color:var(--a-color-muted-soft)">2026.05.29</span>
        </template>
      </PEntry>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
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
