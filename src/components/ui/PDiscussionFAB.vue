<!-- web/src/components/ui/PDiscussionFAB.vue -->
<template>
  <button
    type="button"
    class="discussion-fab"
    :aria-label="count === undefined ? '打开讨论' : `打开讨论，共 ${count} 条`"
    @click="$emit('click')"
  >
    <div class="fab-label">讨论<template v-if="count !== undefined"> ({{ count }})</template></div>
  </button>
</template>

<script setup lang="ts">
defineProps<{ count?: string | number }>()
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
  background: var(--a-color-text);
  border: 1px solid var(--a-color-text);
  border-right: none;
  border-radius: var(--a-radius-none, 4px) 0 0 var(--a-radius-none, 4px);
  box-shadow: none;
  z-index: var(--a-z-navigation);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.discussion-fab:hover {
  transform: translate(-2px, -50%);
  background: var(--a-color-text-secondary);
  border-color: var(--a-color-text-secondary);
}
.fab-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: var(--a-color-bg);
}

@media (max-width: 767px) {
  .discussion-fab {
    position: static;
    width: calc(100% - 2rem);
    height: 44px;
    margin: 0 1rem calc(1rem + env(safe-area-inset-bottom));
    padding: 0 0.9rem;
    border-right: 1px solid var(--a-color-text);
    border-radius: 4px;
    transform: none;
  }

  .discussion-fab:hover {
    transform: translateY(-1px);
  }

  .fab-label {
    writing-mode: horizontal-tb;
    letter-spacing: 0;
  }
}
</style>
