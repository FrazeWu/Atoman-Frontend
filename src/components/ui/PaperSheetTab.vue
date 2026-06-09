<template>
  <button class="sheet-tab" @click="$emit('click')">
    <span class="close-icon">×</span>
    <span class="tab-label">{{ title }}</span>
    <div class="sheet-tab-tape" />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()

defineEmits(['click'])
</script>

<style scoped>
.sheet-tab {
  background-color: white;
  color: black;
  padding-left: 10px;
  padding-right: 18px; /* Slightly reduced */
  padding-top: 8px;
  padding-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  box-shadow: 0 10px 20px rgba(0,0,0,0.05);
  cursor: pointer;
  border: 1px solid rgba(0,0,0,0.05);
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  border-right: none;
  transition: background-color 0.2s, border-color 0.2s;
  outline: none;
  font-family: inherit;
  white-space: nowrap;
}

.close-icon {
  font-size: 1.1rem;
  font-weight: 300;
  color: #999;
  line-height: 1;
}

.tab-label {
  font-size: 0.8rem;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px; /* Reduced from 140px to keep it compact */
}

.sheet-tab-tape {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%) rotate(-2deg);
  width: 32px;
  height: 40px;
  background-color: rgba(0,0,0,0.05);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  pointer-events: none;
  z-index: 10;
}

.sheet-tab:hover {
  background-color: #fafafa;
  border-color: #eee;
}

.sheet-tab:hover .sheet-tab-tape {
  background-color: rgba(0,0,0,0.1);
}
</style>
