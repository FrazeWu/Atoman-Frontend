<template>
  <div
    class="p-image-wrap"
    :class="[
      `p-image-wrap--fit-${fit}`,
      {
        'p-image-wrap--loaded': isLoaded,
        'p-image-wrap--error': isError,
      },
    ]"
    :style="wrapStyle"
  >
    <img
      v-if="optimizedSrc && !isError"
      :src="optimizedSrc"
      :srcset="computedSrcSet || undefined"
      :sizes="sizes || undefined"
      :alt="alt || ''"
      :width="width"
      :height="height"
      :loading="effectiveLoading"
      :fetchpriority="effectiveFetchPriority"
      :decoding="decoding"
      class="p-image"
      :style="{ objectFit: fit }"
      @load="handleLoad"
      @error="handleError"
    />
    <div v-else class="p-image-fallback" role="img" :aria-label="alt || fallbackText || '暂无图片'">
      <slot name="fallback">
        <span v-if="fallbackText" class="p-image-fallback-text">{{ fallbackText }}</span>
        <span v-else class="p-image-fallback-placeholder" aria-hidden="true" />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveMediaImageSrcSet, resolveMediaImageURL } from '@/utils/mediaUrl'

const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    width?: number | string
    height?: number | string
    aspectRatio?: string
    sizes?: string
    srcset?: string
    responsiveWidths?: number[]
    priority?: boolean
    loading?: 'lazy' | 'eager'
    fetchpriority?: 'high' | 'low' | 'auto'
    decoding?: 'async' | 'auto' | 'sync'
    fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
    fallbackText?: string
  }>(),
  {
    src: '',
    alt: '',
    width: undefined,
    height: undefined,
    aspectRatio: undefined,
    sizes: undefined,
    srcset: undefined,
    responsiveWidths: undefined,
    priority: false,
    loading: undefined,
    fetchpriority: undefined,
    decoding: 'async',
    fit: 'cover',
    fallbackText: undefined,
  },
)

const emit = defineEmits<{
  (e: 'load', event: Event): void
  (e: 'error', event: Event): void
}>()

const isLoaded = ref(false)
const isError = ref(false)

watch(
  () => props.src,
  () => {
    isLoaded.value = false
    isError.value = false
  },
)

const numericWidth = computed(() => {
  if (typeof props.width === 'number') return props.width
  if (typeof props.width === 'string') {
    const parsed = parseInt(props.width, 10)
    return isNaN(parsed) ? undefined : parsed
  }
  return undefined
})

const numericHeight = computed(() => {
  if (typeof props.height === 'number') return props.height
  if (typeof props.height === 'string') {
    const parsed = parseInt(props.height, 10)
    return isNaN(parsed) ? undefined : parsed
  }
  return undefined
})

const optimizedSrc = computed(() => {
  const url = props.src?.trim()
  if (!url) return ''
  if (!numericWidth.value) return url
  return resolveMediaImageURL(url, {
    width: numericWidth.value,
    height: numericHeight.value,
    fit: props.fit === 'fill' ? undefined : (props.fit as 'cover' | 'contain' | 'scale-down'),
  })
})

const computedSrcSet = computed(() => {
  if (props.srcset) return props.srcset
  const url = props.src?.trim()
  if (!url || !props.responsiveWidths || props.responsiveWidths.length === 0) return ''
  return resolveMediaImageSrcSet(url, props.responsiveWidths)
})

const effectiveLoading = computed(() => {
  if (props.loading) return props.loading
  return props.priority ? 'eager' : 'lazy'
})

const effectiveFetchPriority = computed(() => {
  if (props.fetchpriority) return props.fetchpriority
  return props.priority ? 'high' : 'auto'
})

const wrapStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.aspectRatio) {
    style.aspectRatio = props.aspectRatio
  }
  return style
})

function handleLoad(event: Event) {
  isLoaded.value = true
  isError.value = false
  emit('load', event)
}

function handleError(event: Event) {
  isLoaded.value = false
  isError.value = true
  emit('error', event)
}
</script>

<style scoped>
.p-image-wrap {
  position: relative;
  display: inline-block;
  overflow: hidden;
  box-shadow: none !important;
  background-color: var(--a-color-surface-muted, #f8fafc);
  border-radius: inherit;
}

.p-image {
  display: block;
  width: 100%;
  height: 100%;
  box-shadow: none !important;
  border-radius: inherit;
}

.p-image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: inherit;
  color: var(--a-color-text-subtle, #94a3b8);
  font-size: 13px;
  background-color: var(--a-color-surface-muted, #f8fafc);
  border-radius: inherit;
  box-shadow: none !important;
  user-select: none;
}

.p-image-fallback-placeholder {
  display: block;
  width: 100%;
  height: 100%;
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.p-image-fallback-text {
  padding: 8px;
  text-align: center;
  line-height: 1.4;
}
</style>
