<template>
  <section class="privacy-settings-panel">
    <div v-if="loading" class="privacy-settings__state" role="status">正在加载隐私设置...</div>
    <div v-else-if="loadError" class="privacy-settings__state privacy-settings__state--error" role="alert">
      <span>{{ loadError }}</span>
      <PButton
        data-test="privacy-settings-retry"
        variant="secondary"
        size="sm"
        type="button"
        @click="load"
      >
        重试
      </PButton>
    </div>
    <div v-else class="privacy-settings__list">
      <div class="settings-block">
        <div class="settings-block__copy">
          <strong>设为私密</strong>
          <small>开启后，其他人无法查看你的个人主页资料。</small>
        </div>
        <div class="settings-block__control">
          <label class="settings-toggle">
            <input
              data-test="private-profile-toggle"
              v-model="privateProfile"
              type="checkbox"
              :disabled="savingKey !== null"
              @change="save('private_profile')"
            />
            <span>{{ privateProfile ? '仅自己可见' : '对所有人公开' }}</span>
          </label>
        </div>
      </div>
      <div class="settings-block">
        <div class="settings-block__copy">
          <strong>公开订阅关系</strong>
          <small>允许他人查看你的订阅中和被订阅列表。</small>
        </div>
        <div class="settings-block__control">
          <label class="settings-toggle">
            <input
              data-test="show-relations-toggle"
              v-model="showRelations"
              type="checkbox"
              :disabled="savingKey !== null"
              @change="save('show_relations')"
            />
            <span>{{ showRelations ? '对所有人公开' : '仅自己可见' }}</span>
          </label>
        </div>
      </div>
    </div>
    <p v-if="saveError" class="privacy-settings__inline-error" role="alert">{{ saveError }}</p>
    <p v-else-if="saved" class="privacy-settings__saved" role="status">{{ savedLabel }}已保存</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { apiRequestResult } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const api = useApi()
const authStore = useAuthStore()
const privateProfile = ref(false)
const showRelations = ref(false)
const loading = ref(true)
const savingKey = ref<SettingKey | null>(null)
const saved = ref(false)
const savedLabel = ref('隐私设置')
const loadError = ref('')
const saveError = ref('')

type SettingsPayload = {
  data?: { private_profile?: unknown; show_relations?: unknown }
  private_profile?: unknown
  show_relations?: unknown
}

type SettingKey = 'private_profile' | 'show_relations'

function authHeaders() {
  return { Authorization: `Bearer ${authStore.token}`, 'Content-Type': 'application/json' }
}

function readSetting(value: unknown, key: SettingKey): boolean | undefined {
  if (!value || typeof value !== 'object') return undefined
  const payload = value as SettingsPayload
  const source = payload.data && typeof payload.data === 'object' ? payload.data : payload
  const candidate = source[key]
  return typeof candidate === 'boolean' ? candidate : undefined
}

function readPrivateProfile(value: unknown) {
  return readSetting(value, 'private_profile') ?? false
}

function readShowRelations(value: unknown) {
  return readSetting(value, 'show_relations') ?? false
}

async function load() {
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  saved.value = false
  try {
    const response = await apiRequestResult(api.users.meSettings, { headers: authHeaders() })
    if (!response.ok) throw new Error('隐私设置加载失败，请重试')
    privateProfile.value = readPrivateProfile(response.data)
    showRelations.value = readShowRelations(response.data)
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '隐私设置加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function save(key: SettingKey) {
  if (savingKey.value) return
  const previous = key === 'private_profile' ? !privateProfile.value : !showRelations.value
  const value = key === 'private_profile' ? privateProfile.value : showRelations.value
  savingKey.value = key
  saved.value = false
  savedLabel.value = key === 'show_relations' ? '订阅关系设置' : '个人资料设置'
  saveError.value = ''
  try {
    const response = await apiRequestResult(api.users.meSettings, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ [key]: value }),
    })
    if (!response.ok) throw new Error('隐私设置保存失败，请重试')
    const savedPrivateProfile = readSetting(response.data, 'private_profile')
    const savedShowRelations = readSetting(response.data, 'show_relations')
    if (savedPrivateProfile !== undefined) privateProfile.value = savedPrivateProfile
    if (savedShowRelations !== undefined) showRelations.value = savedShowRelations
    saved.value = true
  } catch (cause) {
    if (key === 'private_profile') privateProfile.value = previous
    else showRelations.value = previous
    saveError.value = cause instanceof Error ? cause.message : '隐私设置保存失败，请重试'
  } finally {
    savingKey.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.privacy-settings-panel {
  display: grid;
  gap: 0.75rem;
}

.settings-toggle {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.privacy-settings__state,
.privacy-settings__inline-error,
.privacy-settings__saved {
  color: var(--a-color-text-secondary);
}

.privacy-settings__state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 3rem;
}

.privacy-settings__state--error,
.privacy-settings__inline-error {
  color: var(--a-color-accent-destructive);
}

.privacy-settings__saved {
  margin: 0;
  color: var(--a-color-accent-success);
}
</style>
