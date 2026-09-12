<template>
  <div class="p-avatar" :class="[`is-size-${size}`]" :style="avatarStyle">
    <img
      v-if="avatarSrc && !imageFailed"
      :src="avatarSrc"
      :alt="alt"
      :width="avatarSize"
      :height="avatarSize"
      class="avatar-img"
      loading="lazy"
      decoding="async"
      @error="imageFailed = true"
    />
    <span v-else class="avatar-fallback">{{ initials }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveMediaImageURL } from '@/utils/mediaUrl'

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  grayscale?: boolean
}>(), {
  size: 'md',
  grayscale: false
})

const initials = computed(() => {
  if (!props.name) return '?'
  return props.name.charAt(0).toUpperCase()
})

const avatarSize = computed(() => ({ xs: 64, sm: 96, md: 144, lg: 240, xl: 384 })[props.size])
const avatarSrc = computed(() => props.src ? resolveMediaImageURL(props.src, { width: avatarSize.value }) : '')
const imageFailed = ref(false)

watch(avatarSrc, () => {
  imageFailed.value = false
})

const avatarStyle = computed(() => ({
  filter: props.grayscale ? 'grayscale(100%)' : 'none'
}))
</script>

<style scoped>
.p-avatar {
  border-radius: var(--a-radius-none, 4px);
  background: var(--a-color-border-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--a-color-border-soft);
  background-color: var(--a-color-surface-muted);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-weight: 500;
  color: var(--a-color-text-secondary);
}

.is-size-xs { width: 1.25rem; height: 1.25rem; font-size: 0.65rem; }
.is-size-sm { width: 2rem; height: 2rem; font-size: 0.875rem; }
.is-size-md { width: 3rem; height: 3rem; font-size: 1.25rem; }
.is-size-lg { width: 5rem; height: 5rem; font-size: 1.875rem; }
.is-size-xl { width: 8rem; height: 8rem; font-size: 2.5rem; }
</style>
