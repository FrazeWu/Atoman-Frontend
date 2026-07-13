<template>
  <div class="interaction-bar">
    <button
      type="button"
      class="interaction-bar__button"
      :class="{ 'interaction-bar__button--active': liked }"
      :disabled="disabled"
      @click="toggleLike"
    >
      {{ liked ? '已喜欢' : '喜欢' }} {{ likeCount }}
    </button>
    <span class="interaction-bar__count">评论 {{ commentCount }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  liked: boolean
  likeCount: number
  commentCount: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  like: []
  unlike: []
}>()

function toggleLike() {
  if (props.liked) {
    emit('unlike')
    return
  }
  emit('like')
}
</script>

<style scoped>
.interaction-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--a-color-muted);
}

.interaction-bar__button {
  border: 1px solid var(--a-color-line-soft);
  border-radius: 4px;
  padding: 0.5rem 0.875rem;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
}

.interaction-bar__button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.interaction-bar__button--active {
  border-color: var(--a-color-fg);
  font-weight: var(--a-font-weight-strong, 700);
}

.interaction-bar__count {
  font-size: 0.875rem;
}
</style>
