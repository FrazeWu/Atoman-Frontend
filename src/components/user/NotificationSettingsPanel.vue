<template>
  <section class="notification-settings-panel">
    <div class="notification-settings__header">
      <div class="settings-block__copy">
        <strong>通知偏好</strong>
        <small>选择你希望收到的互动提醒。</small>
      </div>
      <PButton to="/inbox" variant="secondary" size="md">打开通知详情</PButton>
    </div>
    <div v-if="loading" class="notification-settings__state" role="status">正在加载通知偏好...</div>
    <div v-else-if="loadError" class="notification-settings__state notification-settings__state--error" role="alert">
      <span>{{ loadError }}</span>
      <PButton
        data-test="notification-settings-retry"
        variant="secondary"
        size="sm"
        type="button"
        @click="load"
      >
        重试
      </PButton>
    </div>
    <template v-else>
      <div class="notification-settings__list">
        <div v-for="group in preferenceGroups" :key="group.key" class="settings-block">
          <div class="settings-block__copy">
            <strong>{{ group.label }}</strong>
            <small>{{ group.description }}</small>
          </div>
          <label class="settings-toggle">
            <input
              :data-test="`notification-${group.key}`"
              v-model="preferences[group.key]"
              type="checkbox"
              :disabled="savingKey !== null"
              @change="savePreference(group.key)"
            />
            <span>{{ preferences[group.key] ? '已开启' : '已关闭' }}</span>
          </label>
        </div>
      </div>
      <p class="notification-settings__note">账号安全、私信和关键权限变化始终提醒。</p>
      <p v-if="saveError" class="notification-settings__error" role="alert">{{ saveError }}</p>
      <p v-if="savedLabel" class="notification-settings__saved" role="status">{{ savedLabel }}已保存</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { apiRequestResult } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { NotificationCategory, NotificationPreference } from '@/types'

const api = useApi()
const authStore = useAuthStore()

type PreferenceGroup = {
  key: 'like' | 'interaction' | 'mention' | 'reply' | 'collaboration'
  label: string
  description: string
  category: NotificationCategory
  eventTypes: string[]
}

const preferenceGroups: PreferenceGroup[] = [
  { key: 'like', label: '点赞提醒', description: '有人赞了你的内容时提醒。', category: 'like', eventTypes: ['comment_like', 'forum_like'] },
  { key: 'interaction', label: '互动提醒', description: '关注、标记和话题状态变化时提醒。', category: 'interaction', eventTypes: ['comment_marked', 'forum_follow', 'forum_solved'] },
  { key: 'mention', label: '提及提醒', description: '有人在内容中提到你时提醒。', category: 'mention', eventTypes: ['comment_mention'] },
  { key: 'reply', label: '回复提醒', description: '有人回复你的内容时提醒。', category: 'reply', eventTypes: ['comment_reply', 'forum_reply', 'forum_topic_comment'] },
  { key: 'collaboration', label: '协作提醒', description: '协作请求和任务变化时提醒。', category: 'collaboration', eventTypes: ['collaboration.required'] },
]

const preferences = reactive<Record<PreferenceGroup['key'], boolean>>({
  like: true,
  interaction: true,
  mention: true,
  reply: true,
  collaboration: true,
})
const loading = ref(true)
const loadError = ref('')
const saveError = ref('')
const savingKey = ref<PreferenceGroup['key'] | null>(null)
const savedLabel = ref('')

function authHeaders() {
  return { Authorization: `Bearer ${authStore.token}`, 'Content-Type': 'application/json' }
}

function responseItems(value: unknown): NotificationPreference[] {
  if (!value || typeof value !== 'object') return []
  const payload = value as { data?: unknown }
  const items = Array.isArray(payload.data) ? payload.data : value
  return Array.isArray(items) ? items as NotificationPreference[] : []
}

function groupFor(key: PreferenceGroup['key']) {
  return preferenceGroups.find((group) => group.key === key) as PreferenceGroup
}

async function load() {
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  savedLabel.value = ''
  try {
    const response = await apiRequestResult(api.notifications.preferences, { headers: authHeaders() })
    if (!response.ok) throw new Error('通知偏好加载失败，请重试')
    const byType = new Map(responseItems(response.data).map((item) => [item.event_type, item.enabled]))
    for (const group of preferenceGroups) {
      preferences[group.key] = group.eventTypes.every((eventType) => byType.get(eventType) !== false)
    }
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '通知偏好加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function savePreference(key: PreferenceGroup['key']) {
  if (savingKey.value) return
  const group = groupFor(key)
  const nextValue = preferences[key]
  savingKey.value = key
  savedLabel.value = ''
  saveError.value = ''
  try {
    const items = preferenceGroups.flatMap((item) => item.eventTypes.map((eventType) => ({
      category: item.category,
      event_type: eventType,
      enabled: item.key === key ? nextValue : preferences[item.key],
    })))
    const response = await apiRequestResult(api.notifications.preferences, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ items }),
    })
    if (!response.ok) throw new Error('通知偏好保存失败，请重试')
    savedLabel.value = group.label
  } catch (cause) {
    preferences[key] = !nextValue
    saveError.value = cause instanceof Error ? cause.message : '通知偏好保存失败，请重试'
  } finally {
    savingKey.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.notification-settings-panel {
  display: grid;
  gap: 0.75rem;
}

.notification-settings__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.notification-settings__list {
  display: grid;
  gap: 0;
}

.settings-toggle {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.notification-settings__state,
.notification-settings__note,
.notification-settings__error,
.notification-settings__saved {
  color: var(--a-color-text-secondary);
}

.notification-settings__state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 3rem;
}

.notification-settings__state--error {
  color: var(--a-color-accent-destructive);
}

.notification-settings__note,
.notification-settings__saved {
  margin: 0;
  font-size: var(--a-text-sm);
}

.notification-settings__error {
  margin: 0;
  color: var(--a-color-accent-destructive);
  font-size: var(--a-text-sm);
}

.notification-settings__saved {
  color: var(--a-color-accent-success);
}
</style>
