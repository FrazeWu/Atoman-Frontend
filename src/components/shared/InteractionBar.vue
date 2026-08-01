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
    <RouterLink v-if="commentHref" :to="commentHref" class="interaction-bar__count interaction-bar__comment">
      评论 {{ commentCount }}
    </RouterLink>
    <span v-else class="interaction-bar__count">评论 {{ commentCount }}</span>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

const props = defineProps<{
  liked: boolean
  likeCount: number
  commentCount: number
  commentHref?: string
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
  border: 1px solid var(--a-color-border-soft);
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

.interaction-bar__comment {
  color: inherit;
  text-decoration: none;
}

.interaction-bar__comment:hover {
  color: var(--a-color-fg);
  text-decoration: underline;
}
</style>
