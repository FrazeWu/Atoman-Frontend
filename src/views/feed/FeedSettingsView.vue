<template>
  <div class="a-page-xl feed-subpage">
    <PPageHeader title="订阅设置" accent>
      <template #action>
        <RouterLink to="/feed" style="text-decoration:none">
          <PPress variant="secondary" label="返回订阅" />
        </RouterLink>
      </template>
    </PPageHeader>

    <div class="feed-timeline">
      <PEntry
        title="尚未开放"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PEntry from '@/components/ui/PEntry.vue'
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
