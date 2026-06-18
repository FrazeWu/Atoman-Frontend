<template>
  <header class="p-section-header" :class="{ 'p-section-header--rule': rule }">
    <p v-if="kicker" class="p-section-header__kicker">{{ kicker }}</p>
    <h2 class="p-section-header__title">{{ title }}</h2>
    <p v-if="description" class="p-section-header__description">{{ description }}</p>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  kicker?: string
  description?: string
  rule?: boolean
}>(), {
  kicker: '',
  description: '',
  rule: false,
})
</script>

<style scoped>
.p-section-header {
  display: grid;
  gap: 8px;
}

.p-section-header--rule {
  padding-bottom: 18px;
  border-bottom: none;
}

.p-section-header__kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: inherit;
  font-size: 11px;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.p-section-header__title {
  margin: 0;
  color: var(--a-color-ink);
  font-size: clamp(1.75rem, 3.5vw, 2.75rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.1;
}

.p-section-header__description {
  max-width: 620px;
  margin: 0;
  color: var(--a-color-ink-muted);
  line-height: 1.7;
}
</style>
