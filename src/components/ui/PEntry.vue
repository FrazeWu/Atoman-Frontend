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
          class="feed-entry-title a-clamp-1"
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
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  padding: 1.25rem;
  margin: 0 0 1rem 0;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  outline: none;
}

.p-entry:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.p-entry.is-open,
.p-entry.is-focused {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
  background: var(--a-color-surface-muted);
}

/* 2. Read State Weakening (Disabled - items do not turn grey) */
.p-entry.is-read {
  opacity: 1;
}
.p-entry.is-read .feed-entry-title {
  color: inherit;
}

/* Underline logic: trigger only on specific element hover */
.feed-entry-title {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  font-family: var(--a-font-sans);
  font-size: 1.05rem;
  font-weight: 550;
  line-height: 1.35;
  margin-bottom: 0.15rem;
  color: var(--a-color-fg);
  transition: all 0.2s;
}

.feed-entry-title:hover,
.p-entry.is-open .feed-entry-title {
  color: var(--a-color-text);
  text-decoration: underline;
  text-decoration-thickness: 1px;
}

/* Meta links / source links hover effect */
:deep(.feed-source-link) {
  transition: all 0.2s;
}
:deep(.feed-source-link:hover) {
  color: var(--a-color-text) !important;
  text-decoration: underline !important;
  text-decoration-thickness: 1px;
}

.feed-entry-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
  font-family: var(--a-font-sans);
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
  background: linear-gradient(to right, transparent, var(--a-color-surface-muted) 40%);
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
  background: linear-gradient(to right, transparent, var(--a-color-surface) 40%);
}

/* Ensure actions stand out */
:deep(.p-clip) {
  /* Inherit default styles, but ensure it's above the wash background */
  z-index: 2;
}
</style>
