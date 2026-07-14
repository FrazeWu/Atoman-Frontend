<template>
  <section class="media-section">
    <div class="media-section-head">
      <h2>文章与播客</h2>
      <PButton
        v-if="normalizedItems.length > 5"
        data-testid="media-expand-mixed"
        variant="ghost"
        size="sm"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开更多' }}
      </PButton>
    </div>

    <RouterLink
      v-for="item in visibleItems"
      :key="item.id"
      :to="itemPath(item)"
      data-testid="media-mixed-item"
      class="a-card-sm media-mixed-item"
    >
      <div class="a-label a-muted">{{ item.type === 'article' ? '文章' : '播客' }}</div>
      <h3>{{ item.title }}</h3>
      <p class="a-muted">{{ item.updated_at }}</p>
    </RouterLink>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import type { MediaMixedItem } from '@/composables/useMediaOverview'
import { modulePathUrl } from '@/router/siteUrls'

const props = withDefaults(defineProps<{
  items?: MediaMixedItem[]
}>(), {
  items: () => [],
})

const expanded = ref(false)
const normalizedItems = computed(() => props.items)
const visibleItems = computed(() => (
  expanded.value ? normalizedItems.value : normalizedItems.value.slice(0, 5)
))

const itemPath = (item: MediaMixedItem) => (
  item.type === 'article'
    ? `/posts/post/${item.id}`
    : modulePathUrl('media', `/podcasts/episode/${item.id}`)
)
</script>
