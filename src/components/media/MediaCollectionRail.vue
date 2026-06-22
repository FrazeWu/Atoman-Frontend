<template>
  <section class="media-section">
    <div class="media-section-head">
      <h2>合集</h2>
    </div>
    <div v-if="loading" class="a-skeleton media-collection-skeleton" />
    <div v-else-if="items.length === 0" class="a-card-sm a-muted">当前频道还没有合集。</div>
    <div v-else class="media-collection-grid">
      <button
        v-for="collection in items"
        :key="collection.id"
        class="a-card-sm media-collection-card"
        :class="{ 'media-collection-card--active': selectedCollectionId === collection.id }"
        type="button"
        @click="selectCollection(collection.id, collection.type, collection.name)"
      >
        <div class="a-label a-muted">{{ typeLabel(collection.type) }}合集</div>
        <h3>{{ collection.name }}</h3>
        <p v-if="typeof collection.count === 'number'" class="a-muted">{{ collection.count }} 条内容</p>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMediaCollections, type MediaCollection } from '@/composables/useMediaCollections'

withDefaults(defineProps<{
  items?: MediaCollection[]
  loading?: boolean
}>(), {
  items: () => [],
  loading: false,
})

const { selectedCollectionId, selectCollection } = useMediaCollections()

const typeLabel = (type: MediaCollection['type']) => {
  if (type === 'podcast') return '播客'
  if (type === 'video') return '视频'
  return '文章'
}
</script>

<style scoped>
.media-collection-skeleton {
  height: 5rem;
}

.media-collection-card--active {
  outline: 2px solid var(--a-color-fg);
}
</style>
