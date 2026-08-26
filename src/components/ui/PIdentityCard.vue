<template>
  <article
    v-bind="$attrs"
    class="p-identity-card"
    :class="{ 'is-compact': compact, 'is-active': active }"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    @click="handleActivate"
    @keydown.enter.prevent="handleActivate"
    @keydown.space.prevent="handleActivate"
  >
    <header class="p-identity-card__header">
      <div class="p-identity-card__visual">
        <slot name="visual" />
      </div>

      <div class="p-identity-card__info">
        <div class="p-identity-card__title-row">
          <slot name="title" />
          <slot v-if="$slots.badge" name="badge" />
        </div>
        <slot name="identity" />
        <slot name="description" />
      </div>

      <div v-if="$slots.actions" class="p-identity-card__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot name="previews" />

    <footer v-if="$slots.footer" class="p-identity-card__footer">
      <slot name="footer" />
    </footer>
  </article>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  interactive?: boolean
  compact?: boolean
  active?: boolean
}>(), {
  interactive: false,
  compact: false,
  active: false,
})

const emit = defineEmits<{
  activate: []
}>()

function handleActivate() {
  if (props.interactive) emit('activate')
}
</script>

<style scoped>
.p-identity-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  padding: 0.85rem 0.95rem;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  color: inherit;
  text-align: left;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.p-identity-card[role='button'] {
  cursor: pointer;
  outline: none;
}

.p-identity-card[role='button']:hover,
.p-identity-card[role='button']:focus-visible,
.p-identity-card.is-active {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.p-identity-card[role='button']:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.p-identity-card__header {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.p-identity-card__visual {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
}

.p-identity-card__visual :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.p-identity-card__info {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.p-identity-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.p-identity-card__title-row :deep(h3) {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-identity-card__actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  min-width: 0;
}

.p-identity-card__previews,
.p-identity-card :deep(.p-identity-card__previews) {
  margin: 0;
}

.p-identity-card__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  color: var(--a-color-muted-soft);
  font-size: 0.7rem;
}

.p-identity-card.is-compact {
  gap: 0.45rem;
  padding: 0.65rem 0.8rem;
}

.p-identity-card.is-compact .p-identity-card__visual {
  width: 2rem;
  height: 2rem;
}

@media (max-width: 640px) {
  .p-identity-card__header {
    grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  }
}
</style>
