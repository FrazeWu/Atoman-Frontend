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
        <div class="manage-toolbar">
          <input
            ref="opmlInputRef"
            class="opml-input"
            type="file"
            accept=".opml,.xml"
            @change="handleOPMLSelected"
          />
          <PPress
            variant="secondary"
            label="导入 OPML"
            :disabled="busy || healthChecking"
            @click="openOPMLPicker"
          />
          <PPress
            variant="secondary"
            label="导出 OPML"
            :disabled="busy || healthChecking || !subscriptions.length"
            @click="exportOPML"
          />
          <PPress
            variant="secondary"
            :label="healthChecking ? '检查中...' : '全部检查'"
            :disabled="busy || healthChecking || !subscriptions.length"
            @click="checkAllSubscriptionsHealth"
          />
        </div>
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
          <div class="group-title">
            <input
              v-if="!group.virtual"
              :value="draftGroupNames[group.id] ?? group.name"
              data-test="group-name-input"
              class="a-input group-name-input"
              :disabled="busy"
              @input="updateDraftGroupName(group.id, $event)"
              @blur="submitGroupRename(group)"
              @keydown.enter.prevent="submitGroupRename(group)"
            />
            <span v-else class="a-font-meta">/ {{ group.name }}</span>
            <PPress
              v-if="!group.virtual"
              variant="secondary"
              label="删除分组"
              :disabled="busy"
              @click="confirmDeleteGroup(group.id)"
            />
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
                  {{ subscriptionSourceLabel(sub) }}
                </p>
                <div class="health-line" :class="`health-${subscriptionHealthStatus(sub)}`">
                  <span class="health-dot" aria-hidden="true"></span>
                  <span>{{ subscriptionHealthLabel(sub) }}</span>
                  <span v-if="sub.last_checked" class="a-muted">
                    {{ formatCheckedAt(sub.last_checked) }}
                  </span>
                </div>
                <p v-if="sub.error_message" class="health-error">
                  {{ sub.error_message }}
                </p>
              </div>

              <div class="subscription-actions">
                <PSelect
                  :model-value="sub.subscription_group_id || ''"
                  :options="groupOptions"
                  :disabled="busy"
                  @update:model-value="moveSubscription(sub.id, String($event))"
                />
                <PPress
                  variant="secondary"
                  label="检查"
                  :disabled="busy || healthChecking"
                  @click="checkSubscriptionHealth(sub.id)"
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
  healthChecking?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-group', name: string): void
  (e: 'rename-subscription', id: string, title: string): void
  (e: 'move-subscription', id: string, groupId: string): void
  (e: 'delete-subscription', id: string): void
  (e: 'rename-group', id: string, name: string): void
  (e: 'delete-group', id: string): void
  (e: 'check-subscription-health', id: string): void
  (e: 'check-all-subscriptions-health'): void
  (e: 'import-opml', file: File): void
  (e: 'export-opml'): void
}>()

const newGroupName = ref('')
const draftTitles = ref<Record<string, string>>({})
const draftGroupNames = ref<Record<string, string>>({})
const opmlInputRef = ref<HTMLInputElement | null>(null)

const groupOptions = computed(() =>
  props.groups.map(group => ({ label: group.name, value: group.id })),
)

const displayGroups = computed(() => [
  ...props.groups.map(group => ({
    id: group.id,
    name: group.name,
    virtual: false,
    subscriptions: props.subscriptions.filter(sub => sub.subscription_group_id === group.id),
  })),
  {
    id: 'unassigned',
    name: '未分类',
    virtual: true,
    subscriptions: props.subscriptions.filter(sub => !sub.subscription_group_id),
  },
])

const subscriptionTitle = (sub: Subscription) =>
  sub.title || sub.feed_source?.title || '未命名订阅'

const subscriptionSourceLabel = (sub: Subscription) =>
  sub.feed_source?.title || sub.title || sub.feed_source?.rss_url || 'RSS'

const updateDraftTitle = (id: string, event: Event) => {
  draftTitles.value[id] = (event.target as HTMLInputElement).value
}

const updateDraftGroupName = (id: string, event: Event) => {
  draftGroupNames.value[id] = (event.target as HTMLInputElement).value
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

const submitGroupRename = (group: { id: string; name: string; virtual?: boolean }) => {
  if (props.busy || group.virtual) return
  const name = (draftGroupNames.value[group.id] ?? group.name).trim()
  if (!name || name === group.name) return
  emit('rename-group', group.id, name)
}

const moveSubscription = (id: string, groupId: string) => {
  if (props.busy) return
  if (!groupId) return
  emit('move-subscription', id, groupId)
}

const checkSubscriptionHealth = (id: string) => {
  if (props.busy || props.healthChecking) return
  emit('check-subscription-health', id)
}

const checkAllSubscriptionsHealth = () => {
  if (props.busy || props.healthChecking || !props.subscriptions.length) return
  emit('check-all-subscriptions-health')
}

const openOPMLPicker = () => {
  if (props.busy || props.healthChecking) return
  opmlInputRef.value?.click()
}

const handleOPMLSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('import-opml', file)
  input.value = ''
}

const exportOPML = () => {
  if (props.busy || props.healthChecking || !props.subscriptions.length) return
  emit('export-opml')
}

const confirmDelete = (id: string) => {
  if (props.busy) return
  if (!window.confirm('确定删除这个订阅源吗？')) return
  emit('delete-subscription', id)
}

const confirmDeleteGroup = (id: string) => {
  if (props.busy) return
  if (!window.confirm('确定删除这个分组吗？分组内订阅源会移动到默认分组。')) return
  emit('delete-group', id)
}

const subscriptionHealthStatus = (sub: Subscription) => sub.health_status || 'healthy'

const subscriptionHealthLabel = (sub: Subscription) => {
  const labels: Record<string, string> = {
    healthy: '正常',
    warning: '警告',
    error: '异常',
  }
  return labels[subscriptionHealthStatus(sub)] || '未知'
}

const formatCheckedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (unit: number) => String(unit).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

watch(() => props.show, (visible) => {
  if (!visible) return
  newGroupName.value = ''
  draftTitles.value = Object.fromEntries(
    props.subscriptions.map(sub => [sub.id, subscriptionTitle(sub)]),
  )
  draftGroupNames.value = Object.fromEntries(
    props.groups.map(group => [group.id, group.name]),
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

watch(() => props.groups, (groups) => {
  if (!props.show) return
  const nextDrafts = { ...draftGroupNames.value }
  groups.forEach((group) => {
    if (!(group.id in nextDrafts)) {
      nextDrafts[group.id] = group.name
    }
  })
  draftGroupNames.value = nextDrafts
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

.manage-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-start;
}

.opml-input {
  display: none;
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
  border-bottom: 1px dashed var(--a-color-line-soft);
  padding-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.group-name-input {
  max-width: 18rem;
  font-weight: 900;
  font-size: 0.8rem;
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

.health-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.75rem;
  font-weight: 800;
}

.health-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--a-color-muted);
}

.health-healthy .health-dot {
  background: #15803d;
}

.health-warning .health-dot {
  background: #b45309;
}

.health-error .health-dot {
  background: #b91c1c;
}

.health-error {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #b91c1c;
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
