<template>
  <div class="paper-avatar" :class="[`is-size-${size}`]" :style="avatarStyle">
    <img v-if="src" :src="src" :alt="alt" class="avatar-img" />
    <span v-else class="avatar-fallback">{{ initials }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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

const avatarStyle = computed(() => ({
  filter: props.grayscale ? 'grayscale(100%)' : 'none'
}))
</script>

<style scoped>
.paper-avatar {
  border-radius: 9999px;
  background: var(--a-color-line-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--a-color-line-soft);
  background-color: var(--a-color-paper-wash);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-weight: 900;
  color: var(--a-color-ink-muted);
}

.is-size-xs { width: 1.25rem; height: 1.25rem; font-size: 0.65rem; }
.is-size-sm { width: 2rem; height: 2rem; font-size: 0.875rem; }
.is-size-md { width: 3rem; height: 3rem; font-size: 1.25rem; }
.is-size-lg { width: 5rem; height: 5rem; font-size: 1.875rem; }
.is-size-xl { width: 8rem; height: 8rem; font-size: 2.5rem; }
</style>
