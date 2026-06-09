<template>
  <div class="music-section">
    <div class="music-section__header" v-if="$slots.title || $slots.actions">
      <div class="music-section__title-wrap">
        <slot name="title" />
      </div>
      <div class="music-section__actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineSlots<{
  title?: () => unknown
  actions?: () => unknown
}>()
</script>

<style scoped>
.music-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.music-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.music-section__title-wrap {
  min-width: 0;
}

.music-section__actions {
  flex: 0 0 auto;
}
</style>
