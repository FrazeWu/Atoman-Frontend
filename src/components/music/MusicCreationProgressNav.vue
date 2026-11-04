<script setup lang="ts">
export interface MusicCreationProgressStep {
  key: string
  label: string
}

defineProps<{
  steps: MusicCreationProgressStep[]
  activeIndex: number
}>()
</script>

<template>
  <nav
    class="creation-progress"
    aria-label="创建专辑流程"
    data-testid="creation-flow-progress"
  >
    <ol class="creation-progress__list">
      <li
        v-for="(progressStep, index) in steps"
        :key="progressStep.key"
        :class="{
          'is-active': activeIndex === index,
          'is-done': activeIndex > index,
        }"
        :data-testid="`creation-flow-progress-step-${progressStep.key}`"
        :data-state="activeIndex > index ? 'done' : activeIndex === index ? 'active' : 'upcoming'"
      >
        <span class="creation-progress__index">{{ index + 1 }}</span>
        <span>{{ progressStep.label }}</span>
      </li>
    </ol>
  </nav>
</template>
