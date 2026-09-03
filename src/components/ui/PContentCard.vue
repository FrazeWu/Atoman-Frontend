<template>
  <div class="p-entry" :class="{ 'has-visual': Boolean($slots.visual || badge), 'is-open': isOpen, 'is-read': isRead, 'is-focused': isFocused, 'force-show-actions': forceShowActions }" @click="$emit('click')">
    <div class="p-entry__body">

      <!-- Left Badge / Image Area -->
      <div v-if="$slots.visual || badge" class="p-entry-visual">
        <slot name="visual">
          <span v-if="badge" class="a-badge-fill">{{ badge }}</span>
        </slot>
      </div>

      <!-- Main Content Area -->
      <div style="flex:1;min-width:0">
        
        <!-- Meta Row -->
        <div class="feed-entry-meta">
          <slot name="meta" />
        </div>

        <!-- Title -->
        <h3
          class="feed-entry-title"
        >
          <slot name="title">{{ title }}</slot>
        </h3>

        <!-- Summary -->
        <p v-if="summary || $slots.summary" class="feed-entry-summary a-clamp-2">
          <slot name="summary">{{ summary }}</slot>
        </p>

        <div v-if="$slots.footer" class="feed-entry-footer">
          <slot name="footer" />
        </div>

        <!-- Actions Row (Hover revealed) -->
        <div v-if="$slots.actions && showActions !== false" class="feed-entry-actions" @click.stop>
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
  showActions?: boolean
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
  transition: border-color 0.2s ease, background-color 0.2s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  outline: none;
}

.p-entry__body {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  position: relative;
  min-width: 0;
}

.p-entry:hover {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.p-entry.content-stream-entry {
  position: relative;
  padding: 0.875rem 1rem;
  margin-bottom: 0;
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--a-color-text) 6%, transparent);
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  transition: border-color 0.18s ease, background-color 0.18s ease;
  overflow: visible;
}

.p-entry.content-stream-entry .p-entry__body {
  gap: 0.35rem;
}

.p-entry.content-stream-entry:not(:has(~ .p-entry.content-stream-entry)) {
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 6%, transparent);
}

.p-entry.content-stream-entry::before {
  content: '';
  position: absolute;
  left: 2.5px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 14px;
  border-radius: 999px;
  background-color: #10b981;
  opacity: 1;
  transition: color 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.p-entry.content-stream-entry:hover,
.p-entry.content-stream-entry:focus-within,
.p-entry.content-stream-entry.is-focused,
.p-entry.content-stream-entry.is-open {
  background: var(--a-color-surface-muted);
}

/* Hover / Focus 悬浮状态：显示完整贯穿黑线 */
.p-entry.content-stream-entry:hover::before,
.p-entry.content-stream-entry:focus-within::before,
.p-entry.content-stream-entry.is-focused::before,
.p-entry.content-stream-entry.is-open::before {
  top: 0;
  bottom: 0;
  left: 0;
  width: 2.5px;
  height: 100%;
  transform: none;
  border-radius: 0;
  background-color: var(--a-color-text);
  opacity: 1;
}

.p-entry.content-stream-entry.is-read::before {
  background-color: transparent;
  opacity: 0;
}

.p-entry.content-stream-entry.is-read:hover::before,
.p-entry.content-stream-entry.is-read:focus-within::before,
.p-entry.content-stream-entry.is-read.is-focused::before,
.p-entry.content-stream-entry.is-read.is-open::before {
  top: 0;
  bottom: 0;
  left: 0;
  width: 2.5px;
  height: 100%;
  transform: none;
  border-radius: 0;
  background-color: var(--a-color-text);
  opacity: 1;
}

.feed-entry-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem 0.85rem;
  margin-top: 0.55rem;
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
}

:deep(.feed-entry-footer > *) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
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
  -webkit-line-clamp: 2;
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
  transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}

.feed-entry-title:hover,
.p-entry.is-open .feed-entry-title {
  color: var(--a-color-text);
  text-decoration: underline;
  text-decoration-thickness: 1px;
}

/* Meta links / source links hover effect */
:deep(.feed-source-link) {
  transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}
:deep(.feed-source-link:hover) {
  color: var(--a-color-text) !important;
  text-decoration: underline !important;
  text-decoration-thickness: 1px;
}

.p-entry.has-visual .feed-entry-meta {
  min-height: 1.25rem;
}

.feed-entry-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  min-width: 0;
  margin-bottom: 0.25rem;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-muted-soft);
}

.feed-entry-meta > * {
  min-width: 0;
}

:deep(.feed-entry-meta a) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.feed-entry-meta time) {
  white-space: nowrap;
}

.p-entry-visual {
  flex-shrink: 0;
  margin-top: 0;
}

/* Statistics are secondary during scanning and become available on intent. */
.p-entry.content-stream-entry :deep(.feed-entry-stats) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem 0.75rem;
  min-width: 0;
}

@media (hover: hover) and (min-width: 768px) {
  .p-entry.content-stream-entry :deep(.feed-entry-stats) {
    display: none;
  }

  .p-entry.content-stream-entry:hover :deep(.feed-entry-stats),
  .p-entry.content-stream-entry:focus-within :deep(.feed-entry-stats),
  .p-entry.content-stream-entry.is-focused :deep(.feed-entry-stats),
  .p-entry.content-stream-entry.is-open :deep(.feed-entry-stats) {
    display: inline-flex;
  }
}

@media (max-width: 767px) {
  .p-entry.content-stream-entry :deep(.feed-entry-stats) {
    display: none;
  }
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
  transition: color 0.2s cubic-bezier(0.2, 0, 0, 1), background-color 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
  z-index: 5;
}

.p-entry:focus-within .feed-entry-actions,
.p-entry:hover .feed-entry-actions,
.p-entry.force-show-actions .feed-entry-actions {
  opacity: 1;
}

.p-entry.is-open .feed-entry-actions {
  background: linear-gradient(to right, transparent, var(--a-color-surface) 40%);
}

.p-entry.content-stream-entry .feed-entry-actions {
  background: linear-gradient(to right, transparent, var(--a-color-surface-muted) 40%);
}

.p-entry.content-stream-entry.is-open .feed-entry-actions {
  background: linear-gradient(to right, transparent, var(--a-color-surface-muted) 40%);
}

/* Ensure actions stand out */
:deep(.p-clip) {
  /* Inherit default styles, but ensure it's above the wash background */
  z-index: 2;
}@media (max-width: 767px) {
  .feed-entry-actions {
    position: static;
    transform: none;
    margin-top: 0.75rem;
    padding: 0.5rem 0 0;
    border-top: 1px solid var(--a-color-border-soft);
    background: transparent;
    opacity: 1;
  }

  :deep(.feed-entry-actions .p-clip) {
    min-width: 44px;
    min-height: 44px;
    padding: 0.5rem;
  }
}

</style>
