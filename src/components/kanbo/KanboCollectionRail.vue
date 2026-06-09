<template>
  <section class="kanbo-section">
    <div class="kanbo-section-head">
      <h2>合集</h2>
    </div>
    <div v-if="loading" class="a-skeleton kanbo-collection-skeleton" />
    <div v-else-if="items.length === 0" class="a-card-sm a-muted">当前频道还没有合集。</div>
    <div v-else class="kanbo-collection-grid">
      <button
        v-for="collection in items"
        :key="collection.id"
        class="a-card-sm kanbo-collection-card"
        :class="{ 'kanbo-collection-card--active': selectedCollectionId === collection.id }"
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
import { useKanboCollections, type KanboCollection } from '@/composables/useKanboCollections'

withDefaults(defineProps<{
  items?: KanboCollection[]
  loading?: boolean
}>(), {
  items: () => [],
  loading: false,
})

const { selectedCollectionId, selectCollection } = useKanboCollections()

const typeLabel = (type: KanboCollection['type']) => {
  if (type === 'podcast') return '播客'
  if (type === 'video') return '视频'
  return '文章'
}
</script>

<style scoped>
.kanbo-collection-skeleton {
  height: 5rem;
}

.kanbo-collection-card--active {
  outline: 2px solid var(--a-color-fg);
}
</style>
