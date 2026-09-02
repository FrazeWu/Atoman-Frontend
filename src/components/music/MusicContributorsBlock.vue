<template>
  <section v-if="total > 0 && visibleContributors.length" class="music-contributors">
    <button
      type="button"
      class="music-contributors__button"
      data-testid="music-contributors-open-history"
      :aria-label="`查看全部修改历史，共 ${total} 位贡献者`"
      @click="emit('open-history')"
    >
      <span class="music-contributors__label">贡献者</span>
      <span class="music-contributors__avatars" aria-hidden="true">
        <span
          v-for="(contributor, index) in visibleContributors"
          :key="contributor.user_id"
          class="music-contributors__avatar"
          :style="{ zIndex: visibleContributors.length - index }"
          :title="contributorName(contributor)"
        >
          <PAvatar
            :src="contributor.avatar_url"
            :name="contributorName(contributor)"
            alt=""
            size="sm"
          />
        </span>
      </span>
      <span class="music-contributors__summary">{{ total }} 人参与</span>
      <ChevronRight :size="16" aria-hidden="true" />
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IconChevronRight as ChevronRight } from '@tabler/icons-vue'
import type { MusicContributor } from '@/api/musicV1'
import PAvatar from '@/components/ui/PAvatar.vue'

const props = defineProps<{
  contributors: MusicContributor[]
  total: number
}>()

const emit = defineEmits<{
  'open-history': []
}>()

const visibleContributors = computed(() => props.contributors.slice(0, 10))

function contributorName(contributor: MusicContributor) {
  return contributor.display_name || contributor.username || '未知用户'
}
</script>

<style scoped>
.music-contributors {
  margin-top: 2rem;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.music-contributors__button {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem 0;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  text-align: left;
}

.music-contributors__button:hover {
  background: var(--a-color-surface-muted);
}

.music-contributors__button:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.music-contributors__label {
  min-width: 4rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.music-contributors__avatars {
  min-width: 0;
  display: flex;
  align-items: center;
  padding-left: 1rem;
}

.music-contributors__avatar {
  display: inline-flex;
  margin-left: -1rem;
}

.music-contributors__avatar :deep(.p-avatar) {
  border: 2px solid var(--a-color-bg);
}

.music-contributors__summary {
  margin-left: auto;
  color: var(--a-color-muted);
  font-size: 0.8125rem;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .music-contributors__button {
    gap: 0.625rem;
  }

  .music-contributors__label {
    min-width: auto;
  }

  .music-contributors__avatars {
    overflow: hidden;
  }
}
</style>
