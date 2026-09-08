<template>
  <section class="setting-management-layout a-page-xl">
    <RouterView />
  </section>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<style scoped>
.setting-management-layout { display: grid; gap: 1.5rem; padding-bottom: 8rem; }
</style>
