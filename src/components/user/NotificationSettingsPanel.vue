<template>
  <section class="notification-settings-panel">
    <div class="notification-settings__header">
      <div class="settings-block__copy">
        <strong>通知偏好</strong>
        <small>控制哪些互动事件会出现在通知中心。</small>
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
          <div class="settings-block__control">
            <label class="notification-switch" :class="{ 'notification-switch--disabled': savingKey !== null }">
              <input
                :data-test="`notification-${group.key}`"
                v-model="preferences[group.key]"
                type="checkbox"
                class="notification-switch__input"
                role="switch"
                :aria-checked="preferences[group.key]"
                :aria-label="`${preferences[group.key] ? '关闭' : '开启'}${group.label}`"
                :disabled="savingKey !== null"
                @change="savePreference(group.key)"
              />
              <span class="notification-switch__track" aria-hidden="true">
                <span class="notification-switch__thumb" />
              </span>
              <span :data-test="`notification-${group.key}-state`" class="notification-switch__state">
                {{ preferences[group.key] ? '开启' : '关闭' }}
              </span>
            </label>
          </div>
        </div>
      </div>
      <p class="notification-settings__note">账号安全和关键权限变化始终通知你，无法关闭。</p>
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
  { key: 'like', label: '点赞提醒', description: '有人点赞你的评论或话题时通知你。', category: 'like', eventTypes: ['comment_like', 'forum_like'] },
  { key: 'interaction', label: '互动提醒', description: '订阅、标记或话题状态发生变化时通知你。', category: 'interaction', eventTypes: ['comment_marked', 'forum_follow', 'forum_solved'] },
  { key: 'mention', label: '提及提醒', description: '有人在评论或话题中提到你时通知你。', category: 'mention', eventTypes: ['comment_mention'] },
  { key: 'reply', label: '回复提醒', description: '有人回复你的评论或话题时通知你。', category: 'reply', eventTypes: ['comment_reply', 'forum_reply', 'forum_topic_comment'] },
  { key: 'collaboration', label: '协作提醒', description: '收到协作邀请或任务变更时通知你。', category: 'collaboration', eventTypes: ['collaboration.required'] },
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
  flex-wrap: wrap;
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

.notification-switch {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.notification-switch--disabled {
  cursor: wait;
  opacity: 0.65;
}

.notification-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.notification-switch__track {
  position: relative;
  display: inline-flex;
  width: 2.75rem;
  height: 1.5rem;
  align-items: center;
  border: 1px solid var(--a-color-border);
  border-radius: 999px;
  background: var(--a-color-surface-muted);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.notification-switch__thumb {
  width: 1.1rem;
  height: 1.1rem;
  margin-left: 0.15rem;
  border-radius: 50%;
  background: var(--a-color-text-secondary);
  box-shadow: 0 1px 2px rgb(0 0 0 / 16%);
  transition: transform 0.15s ease, background 0.15s ease;
}

.notification-switch__input:checked + .notification-switch__track {
  border-color: var(--a-color-primary);
  background: var(--a-color-primary);
}

.notification-switch__input:checked + .notification-switch__track .notification-switch__thumb {
  background: #fff;
  transform: translateX(1.2rem);
}

.notification-switch__input:focus-visible + .notification-switch__track {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.notification-switch__state {
  min-width: 2.25rem;
  color: var(--a-color-text-secondary);
  font-size: var(--a-text-sm);
  text-align: left;
}

.notification-switch__input:checked ~ .notification-switch__state {
  color: var(--a-color-primary);
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
