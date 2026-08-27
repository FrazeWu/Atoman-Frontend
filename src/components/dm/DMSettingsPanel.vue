<template>
  <section class="dm-settings-panel">
    <div v-if="loading" class="dm-settings__state" role="status">正在加载私信权限...</div>
    <div v-else-if="loadError" class="dm-settings__state dm-settings__state--error" role="alert">
      <span>{{ loadError }}</span>
      <PButton type="button" variant="secondary" size="sm" @click="load">重试</PButton>
    </div>
    <div v-else class="dm-settings__control">
      <label>
        <span>私信权限</span>
        <select v-model="permission" :disabled="saving">
          <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <PButton type="button" :loading="saving" :disabled="saving" @click="save">保存</PButton>
    </div>
    <p v-if="saveError" class="dm-settings__message dm-settings__message--error" role="alert">{{ saveError }}</p>
    <p v-else-if="saved" class="dm-settings__message" role="status">私信权限已保存</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import PButton from '@/components/ui/PButton.vue'
import {
  getDMChannelSettings,
  getDMSettings,
  updateDMChannelSettings,
  updateDMSettings,
  type DMPermission,
} from '@/api/dm'

const props = defineProps<{ subject: { type: 'user'; id: string } | { type: 'channel'; id: string } }>()
const permission = ref<DMPermission>('one_before_reply')
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const loadError = ref('')
const saveError = ref('')
let requestGeneration = 0

const options = computed(() => props.subject.type === 'user'
  ? [
      { value: 'one_before_reply' as const, label: '陌生人仅可发一条' },
      { value: 'following_only' as const, label: '仅我关注的人' },
      { value: 'anyone' as const, label: '允许连续发送' },
    ]
  : [
      { value: 'one_before_reply' as const, label: '陌生人仅可发一条' },
      { value: 'anyone' as const, label: '允许连续发送' },
      { value: 'closed' as const, label: '关闭频道私信' },
    ])

async function load() {
  const generation = ++requestGeneration
  loading.value = true
  saved.value = false
  loadError.value = ''
  saveError.value = ''
  try {
    const settings = props.subject.type === 'user'
      ? await getDMSettings()
      : await getDMChannelSettings(props.subject.id)
    if (generation === requestGeneration) permission.value = settings.permission
  } catch {
    if (generation === requestGeneration) loadError.value = '私信权限加载失败，请重试'
  } finally {
    if (generation === requestGeneration) loading.value = false
  }
}

async function save() {
  if (loading.value || saving.value) return
  const generation = ++requestGeneration
  saving.value = true
  saved.value = false
  saveError.value = ''
  try {
    const result = props.subject.type === 'user'
      ? await updateDMSettings({ permission: permission.value })
      : await updateDMChannelSettings(props.subject.id, { permission: permission.value })
    if (generation === requestGeneration) {
      permission.value = result.permission
      saved.value = true
    }
  } catch {
    if (generation === requestGeneration) saveError.value = '私信权限保存失败，请重试'
  } finally {
    if (generation === requestGeneration) saving.value = false
  }
}

onMounted(load)
watch(() => `${props.subject.type}:${props.subject.id}`, load)
</script>

<style scoped>
.dm-settings-panel {
  display: grid;
  gap: 0.75rem;
}

.dm-settings__control {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dm-settings__control label {
  display: grid;
  gap: 0.4rem;
}

.dm-settings__control select {
  min-height: 2.75rem;
  min-width: 12rem;
  padding: 0 0.6rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font: inherit;
}

.dm-settings__state,
.dm-settings__message {
  margin: 0;
  color: var(--a-color-text-secondary);
}

.dm-settings__message--error,
.dm-settings__state--error {
  color: var(--a-color-accent-destructive);
}

@media (max-width: 640px) {
  .dm-settings__control {
    align-items: stretch;
    flex-direction: column;
  }

  .dm-settings__control select {
    width: 100%;
  }
}
</style>
