<template>
  <form class="create-group-form" @submit.prevent="submitGroup">
    <PField label="新建分组">
      <div class="inline-form">
        <PInput v-model="newGroupName" placeholder="例如：技术观察" :disabled="busy" />
        <PButton variant="secondary" label="创建" :disabled="busy" @click="submitGroup" />
      </div>
    </PField>
  </form>

  <div v-if="!groups.length" class="empty-state a-muted">
    暂无分组，在上方新建第一个分组。
  </div>

  <div v-else class="group-manage-list">
    <div
      v-for="group in groups"
      :key="group.id"
      class="group-manage-row"
      :class="{ 'is-system': isDefaultGroup(group) }"
    >
      <strong v-if="isDefaultGroup(group)" class="group-system-name">未分组</strong>
      <PInput
        v-else
        :model-value="draftGroupNames[group.id] ?? group.name"
        data-test="group-name-input"
        class="group-name-input"
        :disabled="busy"
        @input="$emit('update-draft-name', group.id, $event)"
      />
      <span class="group-manage-count a-muted">
        {{ groupSubscriptionCount(group.id) }} 个订阅源
      </span>
      <template v-if="!isDefaultGroup(group)">
        <PButton variant="secondary" label="上移" :disabled="busy || !canMoveGroup(group.id, -1)" @click="$emit('move-group', group.id, -1)" />
        <PButton variant="secondary" label="下移" :disabled="busy || !canMoveGroup(group.id, 1)" @click="$emit('move-group', group.id, 1)" />
        <PButton label="删除" :disabled="busy" @click="$emit('delete-group', group.id)" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Subscription, SubscriptionGroup } from '@/types'
import PButton from '@/components/ui/PButton.vue'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'

const props = defineProps<{
  groups: SubscriptionGroup[]
  subscriptions: Subscription[]
  draftGroupNames: Record<string, string>
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'create-group', name: string): void
  (e: 'move-group', groupId: string, direction: -1 | 1): void
  (e: 'update-draft-name', groupId: string, event: Event): void
  (e: 'delete-group', groupId: string): void
}>()

const newGroupName = ref('')

const isDefaultGroup = (group: Pick<SubscriptionGroup, 'name'>) => group.name === '默认分组'

const groupSubscriptionCount = (groupId: string) => {
  return props.subscriptions.filter(sub => {
    if (groupId && sub.subscription_group_id === groupId) return true
    if (!groupId && !sub.subscription_group_id) return true
    return false
  }).length
}

const canMoveGroup = (groupId: string, direction: -1 | 1) => {
  const index = props.groups.findIndex(g => g.id === groupId)
  if (index === -1) return false
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= props.groups.length) return false
  const targetGroup = props.groups[targetIndex]
  if (targetGroup && isDefaultGroup(targetGroup)) return false
  return true
}

const submitGroup = () => {
  const name = newGroupName.value.trim()
  if (!name) return
  emit('create-group', name)
  newGroupName.value = ''
}
</script>
