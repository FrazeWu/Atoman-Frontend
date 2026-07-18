<template>
  <section class="studio-channel-page">
    <h1>频道设置</h1>
    <p v-if="!studio.channels.length">暂无频道</p>
    <ul v-else>
      <li v-for="channel in studio.channels" :key="channel.id">
        <strong>{{ channel.name }}</strong>
        <span>{{ channel.description }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useStudioStore } from '@/stores/studio'
const studio = useStudioStore()
</script>

<style scoped>
.studio-channel-page{display:grid;gap:1rem}.studio-channel-page h1,.studio-channel-page p,.studio-channel-page ul{margin:0}.studio-channel-page h1{font-size:1.5rem}.studio-channel-page ul{padding:0;list-style:none;border-top:1px solid var(--a-color-border-soft)}.studio-channel-page li{display:grid;grid-template-columns:minmax(8rem,1fr) 2fr;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--a-color-border-soft)}.studio-channel-page span{color:var(--a-color-muted)}
</style>
