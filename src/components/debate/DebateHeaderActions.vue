<template>
  <section class="debate-header-actions">
    <div class="debate-header-actions__stats">
      <span>{{ argumentCount }} 论点</span>
      <span>{{ voteCount }} 投票</span>
      <span>{{ viewCount }}浏览</span>
      <span>{{ createdAt }}</span>
    </div>

    <div class="debate-header-actions__buttons">
      <PButton
        v-if="showVoteToConclude"
        variant="secondary"
        outline
        @click="$emit('vote-to-conclude')"
        :disabled="concludeVoting"
      >
        投票结题 ({{ concludeVoteCount }}/{{ concludeThreshold }})
      </PButton>

      <PButton v-if="showConclude" variant="secondary" @click="$emit('conclude')">
        结题
      </PButton>

      <PButton v-if="showReopen" outline @click="$emit('reopen')" :disabled="reopening">
        重开辩论
      </PButton>

      <PButton v-if="showEdit" variant="secondary" @click="$emit('edit')">
        编辑
      </PButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'

defineProps<{
  argumentCount: number
  voteCount: number
  viewCount: number
  createdAt: string
  showVoteToConclude: boolean
  concludeVoting: boolean
  concludeVoteCount: number
  concludeThreshold: number
  showConclude: boolean
  showReopen: boolean
  reopening: boolean
  showEdit: boolean
}>()

defineEmits<{
  (e: 'vote-to-conclude'): void
  (e: 'conclude'): void
  (e: 'reopen'): void
  (e: 'edit'): void
}>()
</script>

<style scoped>
.debate-header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.debate-header-actions__stats {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-muted);
  flex-wrap: wrap;
}

.debate-header-actions__buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
