<!-- web/src/components/ui/PDiscussionFAB.vue -->
<template>
  <button class="discussion-fab" @click="$emit('click')">
    <div class="fab-label">讨论 ({{ count }})</div>
  </button>
</template>

<script setup lang="ts">
defineProps<{ count: string | number }>()
defineEmits(['click'])
</script>

<style scoped>
.discussion-fab {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  padding: 1.5rem 0;
  background: var(--a-color-ink);
  border: 1px solid var(--a-color-ink);
  border-right: none;
  border-radius: var(--a-radius-none, 4px) 0 0 var(--a-radius-none, 4px);
  box-shadow: none;
  z-index: 1005;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.discussion-fab:hover {
  transform: translate(-2px, -50%);
  background: var(--a-color-ink-muted);
  border-color: var(--a-color-ink-muted);
}
.fab-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: var(--a-color-paper);
}
</style>
