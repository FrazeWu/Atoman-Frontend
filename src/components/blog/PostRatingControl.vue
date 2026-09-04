<template>
  <RatingControl
    v-bind="$attrs"
    class="post-rating"
    aria-label="文章评分"
    :rating-score="ratingScore"
    :rating-count="ratingCount"
    :viewer-rating="viewerRating"
    :disabled="disabled"
    :loading="loading"
    :error-message="errorMessage"
    :size="size === 'sm' ? 'compact' : 'regular'"
    @rate="emit('rate', $event)"
    @clear="emit('clear')"
  />
</template>

<script setup lang="ts">
import RatingControl from '@/components/shared/RatingControl.vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  ratingScore?: number | null
  ratingCount?: number | null
  viewerRating?: number | null
  disabled?: boolean
  loading?: boolean
  errorMessage?: string
  size?: 'sm' | 'md'
}>(), {
  ratingScore: 0,
  ratingCount: 0,
  viewerRating: null,
  disabled: false,
  loading: false,
  errorMessage: '',
  size: 'md',
})

const emit = defineEmits<{
  rate: [score: number]
  clear: []
}>()
</script>
