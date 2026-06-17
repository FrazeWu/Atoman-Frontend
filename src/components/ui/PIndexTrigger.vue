<template>
  <button
    class="p-index-trigger"
    :class="[`is-${position}`, { 'is-active': active }]"
    @click="$emit('click')"
  >
    <div class="trigger-label">
      <slot>INDEX</slot>
    </div>
    <div class="trigger-tape"></div>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  position?: 'right' | 'top'
  active?: boolean
}>(), {
  position: 'right',
  active: false
})

defineEmits(['click'])
</script>

<style scoped>
.p-index-trigger {
  position: relative;
  background: white;
  border: 1px solid var(--a-color-line-soft);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  padding: 0;
  z-index: 40;
}

/* Right Edge Position (Fixed to viewport) */
.p-index-trigger.is-right {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  padding: 1.25rem 0;
  background: var(--a-color-ink);
  border: 1px solid var(--a-color-ink);
  border-right: none;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  box-shadow: -4px 4px 15px rgba(0, 0, 0, 0.12);
  z-index: 1001; /* Higher than sidebar if needed, but below modal backdrops */
}

.p-index-trigger.is-right .trigger-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: var(--a-color-paper);
  transition: opacity 0.2s;
}

.p-index-trigger.is-right .trigger-tape {
  position: absolute;
  right: -1px;
  top: 15%;
  bottom: 15%;
  width: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: none;
}

.p-index-trigger.is-right:hover {
  transform: translate(-4px, -50%);
  box-shadow: -10px 10px 30px rgba(0, 0, 0, 0.2);
}

.p-index-trigger.is-right.is-active {
  transform: translate(0, -50%); /* Don't move it when active so user can double click */
  border-right: 1px solid var(--a-color-ink);
  z-index: 1002; /* Ensure it stays above the sheet */
  background: var(--a-color-paper);
}

.p-index-trigger.is-right.is-active .trigger-label {
  color: var(--a-color-ink);
}

.p-index-trigger.is-right:hover .trigger-label,
.p-index-trigger.is-right.is-active .trigger-label {
  opacity: 1;
}

/* Top/Inline Position (for header use) */
.p-index-trigger.is-top {
  padding: 0.5rem 1rem;
  border-bottom: 2px solid var(--a-color-fg);
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.p-index-trigger.is-top:hover {
  background: var(--a-color-paper-wash);
}
</style>
