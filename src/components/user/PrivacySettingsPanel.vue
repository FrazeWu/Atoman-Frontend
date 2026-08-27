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
    <div v-else class="settings-block">
      <div class="settings-block__copy">
        <strong>公开个人资料</strong>
        <small>关闭后，其他人无法查看你的个人主页资料。</small>
      </div>
      <label class="settings-toggle">
        <input
          data-test="private-profile-toggle"
          v-model="privateProfile"
          type="checkbox"
          :disabled="saving"
          @change="save"
        />
        <span>{{ privateProfile ? '仅自己可见' : '对所有人公开' }}</span>
      </label>
    </div>
    <p v-if="saveError" class="privacy-settings__inline-error" role="alert">{{ saveError }}</p>
    <p v-else-if="saved" class="privacy-settings__saved" role="status">个人资料设置已保存</p>
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
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const loadError = ref('')
const saveError = ref('')

type SettingsPayload = {
  data?: { private_profile?: unknown }
  private_profile?: unknown
}

function authHeaders() {
  return { Authorization: `Bearer ${authStore.token}`, 'Content-Type': 'application/json' }
}

function readPrivateProfile(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const payload = value as SettingsPayload
  const nested = payload.data && typeof payload.data === 'object' ? payload.data.private_profile : undefined
  return typeof nested === 'boolean' ? nested : payload.private_profile === true
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
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '隐私设置加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (saving.value) return
  const previous = !privateProfile.value
  saving.value = true
  saved.value = false
  saveError.value = ''
  try {
    const response = await apiRequestResult(api.users.meSettings, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ private_profile: privateProfile.value }),
    })
    if (!response.ok) throw new Error('隐私设置保存失败，请重试')
    privateProfile.value = readPrivateProfile(response.data)
    saved.value = true
  } catch (cause) {
    privateProfile.value = previous
    saveError.value = cause instanceof Error ? cause.message : '隐私设置保存失败，请重试'
  } finally {
    saving.value = false
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
