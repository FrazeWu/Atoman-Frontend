<template>
  <PSheet
    :show="show"
    title="SUBSCRIPTION_MANAGE"
    close-type="header"
    width="min(100%, 640px)"
    @close="$emit('close')"
  >
    <div class="manage-sheet">
      <div class="manage-heading">
        <h2 class="a-title-sm">订阅源管理</h2>
        <p class="a-muted manage-copy">整理已有订阅源的名称和分组。</p>
      </div>

      <form class="create-group-form" @submit.prevent="submitGroup">
        <PField label="新建分组">
          <div class="inline-form">
            <input v-model="newGroupName" placeholder="例如：技术观察" class="a-input" :disabled="busy" />
            <PPress variant="secondary" label="创建" :disabled="busy" @click="submitGroup" />
          </div>
        </PField>
      </form>

      <div v-if="!subscriptions.length" class="empty-state a-muted">
        暂无订阅源，点击页面上的 “+ 订阅” 添加。
      </div>

      <div v-else class="group-list">
        <section v-for="group in displayGroups" :key="group.id" class="group-section">
          <div class="group-title a-font-meta">
            / {{ group.name }}
          </div>

          <div v-if="!group.subscriptions.length" class="group-empty a-muted">
            此分组暂无订阅源
          </div>

          <div v-else class="subscription-list">
            <div v-for="sub in group.subscriptions" :key="sub.id" class="subscription-card">
              <div class="subscription-main">
                <input
                  :value="draftTitles[sub.id] ?? subscriptionTitle(sub)"
                  class="a-input title-input"
                  :disabled="busy"
                  @input="updateDraftTitle(sub.id, $event)"
                  @blur="submitRename(sub)"
                  @keydown.enter.prevent="submitRename(sub)"
                />
                <p class="source-url a-muted">
                  {{ sub.feed_source?.rss_url || 'RSS' }}
                </p>
              </div>

              <div class="subscription-actions">
                <PSelect
                  :model-value="sub.subscription_group_id || ''"
                  :options="groupOptions"
                  :disabled="busy"
                  @update:model-value="moveSubscription(sub.id, String($event))"
                />
                <PPress variant="secondary" label="删除" :disabled="busy" @click="confirmDelete(sub.id)" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Subscription, SubscriptionGroup } from '@/types'
import PSheet from '@/components/ui/PSheet.vue'
import PField from '@/components/ui/PField.vue'
import PPress from '@/components/ui/PPress.vue'
import PSelect from '@/components/ui/PSelect.vue'

const props = defineProps<{
  show: boolean
  subscriptions: Subscription[]
  groups: SubscriptionGroup[]
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-group', name: string): void
  (e: 'rename-subscription', id: string, title: string): void
  (e: 'move-subscription', id: string, groupId: string): void
  (e: 'delete-subscription', id: string): void
}>()

const newGroupName = ref('')
const draftTitles = ref<Record<string, string>>({})

const groupOptions = computed(() =>
  props.groups.map(group => ({ label: group.name, value: group.id })),
)

const displayGroups = computed(() => [
  ...props.groups.map(group => ({
    id: group.id,
    name: group.name,
    subscriptions: props.subscriptions.filter(sub => sub.subscription_group_id === group.id),
  })),
  {
    id: 'unassigned',
    name: '未分类',
    subscriptions: props.subscriptions.filter(sub => !sub.subscription_group_id),
  },
])

const subscriptionTitle = (sub: Subscription) =>
  sub.title || sub.feed_source?.title || '未命名订阅'

const updateDraftTitle = (id: string, event: Event) => {
  draftTitles.value[id] = (event.target as HTMLInputElement).value
}

const submitGroup = () => {
  if (props.busy) return
  const name = newGroupName.value.trim()
  if (!name) return
  emit('create-group', name)
  newGroupName.value = ''
}

const submitRename = (sub: Subscription) => {
  if (props.busy) return
  const title = (draftTitles.value[sub.id] ?? subscriptionTitle(sub)).trim()
  if (!title || title === subscriptionTitle(sub)) return
  emit('rename-subscription', sub.id, title)
}

const moveSubscription = (id: string, groupId: string) => {
  if (props.busy) return
  if (!groupId) return
  emit('move-subscription', id, groupId)
}

const confirmDelete = (id: string) => {
  if (props.busy) return
  if (!window.confirm('确定删除这个订阅源吗？')) return
  emit('delete-subscription', id)
}

watch(() => props.show, (visible) => {
  if (!visible) return
  newGroupName.value = ''
  draftTitles.value = Object.fromEntries(
    props.subscriptions.map(sub => [sub.id, subscriptionTitle(sub)]),
  )
})

watch(() => props.subscriptions, (subscriptions) => {
  if (!props.show) return
  const nextDrafts = { ...draftTitles.value }
  subscriptions.forEach((sub) => {
    if (!(sub.id in nextDrafts)) {
      nextDrafts[sub.id] = subscriptionTitle(sub)
    }
  })
  draftTitles.value = nextDrafts
})
</script>

<style scoped>
.manage-sheet {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.manage-heading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.manage-copy {
  margin: 0;
}

.create-group-form {
  padding-bottom: 1.5rem;
  border-bottom: 1px dashed var(--a-color-line-soft);
}

.inline-form {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.inline-form .a-input {
  flex: 1;
}

.empty-state,
.group-empty {
  font-size: 0.875rem;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.group-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-title {
  font-weight: 900;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  color: var(--a-color-muted);
  text-transform: uppercase;
  border-bottom: 1px dashed var(--a-color-line-soft);
  padding-bottom: 0.5rem;
}

.subscription-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subscription-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 15rem;
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  background: var(--a-color-paper-wash);
  border: 1px solid var(--a-color-line-soft);
  border-radius: 4px;
}

.subscription-main {
  min-width: 0;
}

.title-input {
  font-weight: 800;
}

.source-url {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .inline-form,
  .subscription-card {
    display: flex;
    flex-direction: column;
  }

  .subscription-actions {
    width: 100%;
  }
}
</style>
