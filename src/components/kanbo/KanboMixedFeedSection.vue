<template>
  <section class="kanbo-section">
    <div class="kanbo-section-head">
      <h2>文章与播客</h2>
      <ABtn
        v-if="normalizedItems.length > 5"
        data-testid="kanbo-expand-mixed"
        variant="ghost"
        size="sm"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开更多' }}
      </ABtn>
    </div>

    <div
      v-for="item in visibleItems"
      :key="item.id"
      data-testid="kanbo-mixed-item"
      class="a-card-sm kanbo-mixed-item"
    >
      <div class="a-label a-muted">{{ item.type === 'article' ? '文章' : '播客' }}</div>
      <h3>{{ item.title }}</h3>
      <p class="a-muted">{{ item.updated_at }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ABtn from '@/components/ui/ABtn.vue'
import type { KanboMixedItem } from '@/composables/useKanboOverview'

const props = withDefaults(defineProps<{
  items?: KanboMixedItem[]
}>(), {
  items: () => [],
})

const expanded = ref(false)
const normalizedItems = computed(() => props.items)
const visibleItems = computed(() => (
  expanded.value ? normalizedItems.value : normalizedItems.value.slice(0, 5)
))
</script>
