<template>
  <header class="a-section-header" :class="{ 'a-section-header--rule': rule }">
    <p v-if="kicker" class="a-section-header__kicker">{{ kicker }}</p>
    <h2 class="a-section-header__title">{{ title }}</h2>
    <p v-if="description" class="a-section-header__description">{{ description }}</p>
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
.a-section-header {
  display: grid;
  gap: 8px;
}

.a-section-header--rule {
  padding-bottom: 18px;
  border-bottom: 6px solid var(--a-color-ink);
}

.a-section-header__kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.a-section-header__title {
  margin: 0;
  color: var(--a-color-ink);
  font-size: clamp(28px, 4vw, 54px);
  font-weight: 950;
  letter-spacing: -0.05em;
  line-height: 0.96;
}

.a-section-header__description {
  max-width: 620px;
  margin: 0;
  color: var(--a-color-ink-muted);
  line-height: 1.7;
}
</style>
