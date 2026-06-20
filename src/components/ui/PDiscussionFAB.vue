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
  border-radius: 0px; /* Straight corner */
  box-shadow: -2px 2px 0px rgba(0, 0, 0, 0.15); /* Hard shadow */
  z-index: 1005;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.discussion-fab:hover {
  transform: translate(-4px, -50%); /* Displaces left */
  background: #6b4f3a; /* Walnut brown hover */
  border-color: #6b4f3a;
}
.fab-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: var(--a-color-paper);
}
</style>
