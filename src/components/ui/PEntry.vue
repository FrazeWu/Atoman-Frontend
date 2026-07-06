<template>
  <div
    class="p-entry"
    :class="{ 'is-open': isOpen, 'is-read': isRead, 'is-focused': isFocused, 'force-show-actions': forceShowActions }"
    @click="$emit('click')"
  >
    <div style="display:flex;gap:1.25rem;align-items:flex-start;position:relative;">
      
      <!-- Left Badge / Image Area -->
      <slot name="visual">
        <span v-if="badge" class="a-badge-fill" style="flex-shrink:0">{{ badge }}</span>
      </slot>

      <!-- Main Content Area -->
      <div style="flex:1;min-width:0">
        
        <!-- Meta Row -->
        <div class="feed-entry-meta">
          <slot name="meta" />
        </div>

        <!-- Title -->
        <h3 
          class="feed-entry-title a-clamp-2"
        >
          <slot name="title">{{ title }}</slot>
        </h3>

        <!-- Summary -->
        <p v-if="summary || $slots.summary" class="feed-entry-summary a-clamp-2">
          <slot name="summary">{{ summary }}</slot>
        </p>

        <!-- Actions Row (Hover revealed) -->
        <div v-if="$slots.actions" class="feed-entry-actions" @click.stop>
          <slot name="actions" />
        </div>
        
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  badge?: string
  title?: string
  summary?: string
  isOpen?: boolean
  isRead?: boolean
  isFocused?: boolean
  forceShowActions?: boolean
}>()

defineEmits(['click'])
</script>

<style scoped>
.p-entry {
  display: block;
  text-decoration: none;
  color: inherit;
  border-bottom: 1.5px dashed var(--a-color-line-soft);
  padding: 0.75rem 1.5rem;
  margin: 0 -1.5rem;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  border-radius: var(--a-radius-none, 0px);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  border-left: 4px solid transparent;
  outline: none;
}
.p-entry:last-child {
  border-bottom: none;
}
.p-entry:hover {
  background-color: var(--a-color-paper-wash);
}
.p-entry.is-open {
  background-color: var(--a-color-paper-soft);
  box-shadow: inset -4px 0 0 var(--a-color-accent-confirm);
  border-bottom-color: transparent;
}
.p-entry.is-focused {
  background-color: var(--a-color-paper-wash);
  border-left-color: var(--a-color-accent-confirm);
}

/* 2. Read State Weakening */
.p-entry.is-read {
  opacity: 0.6;
}
.p-entry.is-read .feed-entry-title {
  color: var(--a-color-muted);
  font-weight: 500;
}

/* Underline logic: trigger only on specific element hover */
.feed-entry-title {
  display: inline-block; /* Ensure underline fits content if it was smaller, but h3 is block */
  width: fit-content;
  font-family: var(--a-font-serif);
  font-size: 1.15rem; /* Slightly smaller for tighter layout */
  font-weight: 900;
  line-height: 1.3;
  margin-bottom: 0;
  color: var(--a-color-fg);
  transition: all 0.2s;
}

.feed-entry-title:hover,
.p-entry.is-open .feed-entry-title {
  color: var(--a-color-ink);
  text-decoration: underline;
  text-decoration-thickness: 2px;
}

/* Meta links / source links hover effect */
:deep(.feed-source-link) {
  transition: all 0.2s;
}
:deep(.feed-source-link:hover) {
  color: var(--a-color-ink) !important;
  text-decoration: underline !important;
  text-decoration-thickness: 1px;
}

.feed-entry-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-muted-soft);
}

.feed-entry-summary {
  font-size: 0.85rem; /* Slightly smaller for tighter layout */
  color: var(--a-color-muted);
  line-height: 1.5;
  margin-top: 0;
  margin-bottom: 0; /* Minimized */
}

/* 1. Actions Hover reveal */
.feed-entry-actions {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-left: 2rem;
  background: linear-gradient(to right, transparent, var(--a-color-paper-wash) 40%);
  opacity: 0;
  pointer-events: auto;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  z-index: 5;
}

.p-entry:hover .feed-entry-actions,
.p-entry.force-show-actions .feed-entry-actions {
  opacity: 1;
}

.p-entry.is-open .feed-entry-actions {
  background: linear-gradient(to right, transparent, var(--a-color-paper-soft) 40%);
}

/* Ensure actions stand out */
:deep(.p-clip) {
  /* Inherit default styles, but ensure it's above the wash background */
  z-index: 2;
}
</style>
