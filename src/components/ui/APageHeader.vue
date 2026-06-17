<template>
  <header class="a-page-header" :class="{ 'a-page-header--accent': accent }" :style="{ marginBottom: mb }">
    <div>
      <p v-if="kicker" class="a-page-header__kicker">{{ kicker }}</p>
      <h1 class="a-page-header__title">
        <slot>{{ title }}</slot>
      </h1>
      <p v-if="sub" class="a-page-header__sub">{{ sub }}</p>
    </div>
    <div v-if="$slots.action" class="a-page-header__action">
      <slot name="action" />
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  sub?: string
  kicker?: string
  accent?: boolean
  mb?: string
}>(), {
  title: '',
  sub: '',
  kicker: '',
  accent: false,
  mb: '2.5rem',
})
</script>

<style scoped>
.a-page-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
}

.a-page-header--accent {
  border-bottom: 1px solid var(--a-color-line);
}

.a-page-header__kicker,
.a-page-header__title,
.a-page-header__sub {
  margin: 0;
}

.a-page-header__kicker {
  color: var(--a-color-ink-soft);
  font-family: inherit;
  font-size: 11px;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.a-page-header__title {
  color: var(--a-color-ink);
  font-size: clamp(2.25rem, 5vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.1;
}

.a-page-header__sub {
  max-width: 680px;
  margin-top: 14px;
  color: var(--a-color-ink-muted);
  line-height: 1.7;
}

.a-page-header__action {
  flex: 0 0 auto;
}
</style>
