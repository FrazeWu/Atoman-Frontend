<template>
  <section class="kanbo-workspace a-card-sm">
    <div v-if="activeCollection?.type === 'article'">
      <h2>文章工作区</h2>
      <p class="a-muted">当前合集：{{ activeCollection.name }}</p>
    </div>
    <div v-else-if="activeCollection?.type === 'podcast'">
      <h2>播客工作区</h2>
      <p class="a-muted">当前合集：{{ activeCollection.name }}</p>
    </div>
    <div v-else-if="activeCollection?.type === 'video'">
      <h2>视频工作区</h2>
      <p class="a-muted">当前合集：{{ activeCollection.name }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useKanboCollections } from '@/composables/useKanboCollections'

const { selectedCollection } = useKanboCollections()
const activeCollection = computed(() => selectedCollection.value)
</script>
