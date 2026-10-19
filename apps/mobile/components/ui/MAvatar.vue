<template>
  <div
    class="m-avatar"
    :style="avatarStyle"
    :aria-label="name || 'Avatar'"
    role="img"
  >
    <img
      v-if="src && !imageFailed"
      :src="src"
      :alt="name || 'Avatar'"
      class="m-avatar__img"
      loading="lazy"
      decoding="async"
      @error="imageFailed = true"
    />
    <span v-else class="m-avatar__monogram">
      {{ monogram }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string
    name?: string
    size?: number
  }>(),
  {
    src: '',
    name: '',
    size: 32,
  }
)

const imageFailed = ref(false)

watch(
  () => props.src,
  () => {
    imageFailed.value = false
  }
)

const monogram = computed(() => {
  const trimmed = props.name?.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
})

const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(10, Math.round(props.size * 0.42))}px`,
}))
</script>

<style scoped>
.m-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  background-color: var(--a-color-surface-muted, #f8fafc);
  color: var(--a-color-text, #0f172a);
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
  box-sizing: border-box;
}

.m-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.m-avatar__monogram {
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
}
</style>
