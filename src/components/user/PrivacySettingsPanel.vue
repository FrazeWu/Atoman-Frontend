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
          <small>开启后，只有你能查看个人主页资料。</small>
        </div>
        <div class="settings-block__control">
          <label class="privacy-switch" :class="{ 'privacy-switch--disabled': savingKey !== null }">
            <input
              data-test="private-profile-toggle"
              v-model="privateProfile"
              type="checkbox"
              class="privacy-switch__input"
              role="switch"
              :aria-checked="privateProfile"
              :aria-label="`${privateProfile ? '关闭' : '开启'}设为私密`"
              :disabled="savingKey !== null"
              @change="save('private_profile')"
            />
            <span class="privacy-switch__track" aria-hidden="true">
              <span class="privacy-switch__thumb" />
            </span>
            <span data-test="private-profile-state" class="privacy-switch__state">
              {{ privateProfile ? '开启' : '关闭' }}
            </span>
          </label>
        </div>
      </div>
      <div class="settings-block">
        <div class="settings-block__copy">
          <strong>公开订阅关系</strong>
          <small>开启后，其他人可以查看你的订阅中和被订阅列表。</small>
        </div>
        <div class="settings-block__control">
          <label class="privacy-switch" :class="{ 'privacy-switch--disabled': savingKey !== null }">
            <input
              data-test="show-relations-toggle"
              v-model="showRelations"
              type="checkbox"
              class="privacy-switch__input"
              role="switch"
              :aria-checked="showRelations"
              :aria-label="`${showRelations ? '关闭' : '开启'}公开订阅关系`"
              :disabled="savingKey !== null"
              @change="save('show_relations')"
            />
            <span class="privacy-switch__track" aria-hidden="true">
              <span class="privacy-switch__thumb" />
            </span>
            <span data-test="show-relations-state" class="privacy-switch__state">
              {{ showRelations ? '开启' : '关闭' }}
            </span>
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

.privacy-switch {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.privacy-switch--disabled {
  cursor: wait;
  opacity: 0.65;
}

.privacy-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.privacy-switch__track {
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

.privacy-switch__thumb {
  width: 1.1rem;
  height: 1.1rem;
  margin-left: 0.15rem;
  border-radius: 50%;
  background: var(--a-color-text-secondary);
  box-shadow: 0 1px 2px rgb(0 0 0 / 16%);
  transition: transform 0.15s ease, background 0.15s ease;
}

.privacy-switch__input:checked + .privacy-switch__track {
  border-color: var(--a-color-primary);
  background: var(--a-color-primary);
}

.privacy-switch__input:checked + .privacy-switch__track .privacy-switch__thumb {
  background: #fff;
  transform: translateX(1.2rem);
}

.privacy-switch__input:focus-visible + .privacy-switch__track {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.privacy-switch__state {
  min-width: 2.25rem;
  color: var(--a-color-text-secondary);
  font-size: var(--a-text-sm);
  text-align: left;
}

.privacy-switch__input:checked ~ .privacy-switch__state {
  color: var(--a-color-primary);
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
