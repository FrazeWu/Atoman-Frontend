<template>
  <p
    v-if="message"
    class="p-action-feedback"
    :class="`p-action-feedback--${tone}`"
    :role="tone === 'error' ? 'alert' : 'status'"
    :aria-live="tone === 'error' ? 'assertive' : 'polite'"
  >
    {{ message }}
  </p>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  tone?: 'error' | 'success' | 'info'
}>(), {
  message: '',
  tone: 'error',
})
</script>
