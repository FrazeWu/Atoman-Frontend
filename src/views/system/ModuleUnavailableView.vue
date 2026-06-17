<template>
  <main class="a-page-md unavailable-page">
    <PSectionHeader
      title="暂未开放"
      kicker="CLOSED"
      description="这个模块或功能当前没有对外开放。"
      rule
    />
    <PButton to="/" variant="secondary">返回首页</PButton>
  </main>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
</script>

<style scoped>
.unavailable-page {
  display: grid;
  gap: 2rem;
  padding-top: 4rem;
}
</style>
