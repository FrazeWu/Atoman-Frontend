<template>
  <PSheet
    :show="show"
    title="SUBSCRIPTION_INDEX"
    close-type="header"
    @close="$emit('close')"
  >
    <div v-for="(group, idx) in groups" :key="group.id" class="group-section">
      <div class="group-title a-font-meta">/ {{ String(idx + 1).padStart(2, '0') }}. {{ group.name }}</div>
      <div class="subscription-links">
        <div 
          v-for="sub in groupSubscriptions(group.id)" 
          :key="sub.id"
          class="sub-link"
          :class="{ active: activeSourceId === sub.id }"
          @click="$emit('select-source', sub.id)"
        >
          <span class="sub-link-dot">·</span>
          <span class="sub-link-text">{{ sub.title || sub.feed_source?.title || '未命名订阅' }}</span>
        </div>
      </div>
    </div>
    
    <!-- Unassigned subscriptions -->
    <div v-if="unassignedSubscriptions.length" class="group-section">
      <div class="group-title a-font-meta">/ 00. 未分类</div>
      <div class="subscription-links">
        <div 
          v-for="sub in unassignedSubscriptions" 
          :key="sub.id"
          class="sub-link"
          :class="{ active: activeSourceId === sub.id }"
          @click="$emit('select-source', sub.id)"
        >
          <span class="sub-link-dot">·</span>
          <span class="sub-link-text">{{ sub.title || sub.feed_source?.title || '未命名订阅' }}</span>
        </div>
      </div>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Subscription, SubscriptionGroup } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'

const props = defineProps<{
  show?: boolean
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
  activeSourceId?: string | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'select-source', sourceId: string): void
}>()

const groupSubscriptions = (groupId: string) => {
  return props.subscriptions.filter(sub => sub.subscription_group_id === groupId)
}

const unassignedSubscriptions = computed(() => {
  return props.subscriptions.filter(sub => !sub.subscription_group_id)
})
</script>

<style scoped>
.group-section {
  margin-bottom: 2.5rem;
}

.group-title {
  font-weight: 900;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  margin-bottom: 1.25rem;
  color: var(--a-color-muted);
  text-transform: uppercase;
  border-bottom: 1px dashed var(--a-color-line-soft);
  padding-bottom: 0.5rem;
}

.subscription-links {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sub-link {
  font-family: var(--a-font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  display: flex;
  gap: 0.75rem;
  transition: all 0.2s;
  color: var(--a-color-muted);
  border-radius: 0px;
}

.sub-link:hover {
  background: var(--a-color-paper-wash);
  color: var(--a-color-fg);
}

.sub-link.active {
  background: var(--a-color-paper-soft);
  color: var(--a-color-fg);
  font-weight: 800;
}

.sub-link-dot {
  opacity: 0.3;
}

.sub-link-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
