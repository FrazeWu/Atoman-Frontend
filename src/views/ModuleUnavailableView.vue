<template>
  <main class="a-page-md unavailable-page">
    <ASectionHeader
      title="暂未开放"
      kicker="CLOSED"
      description="这个模块或功能当前没有对外开放。"
      rule
    />
    <ABtn to="/" variant="secondary">返回首页</ABtn>
  </main>
</template>

<script setup lang="ts">
import ABtn from '@/components/ui/ABtn.vue'
import ASectionHeader from '@/components/ui/ASectionHeader.vue'
</script>

<style scoped>
.unavailable-page {
  display: grid;
  gap: 2rem;
  padding-top: 4rem;
}
</style>
