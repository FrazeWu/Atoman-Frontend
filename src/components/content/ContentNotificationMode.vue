<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useContentLifecycle, type ContentNotificationPreference } from '@/composables/useContentLifecycle'

const props = defineProps<{
  sourceType: ContentNotificationPreference['source_type']
  sourceId: string
  initialMode?: ContentNotificationPreference['mode']
}>()
const lifecycle = useContentLifecycle()
const mode = ref<ContentNotificationPreference['mode']>('feed_only')
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  if (props.initialMode) {
    mode.value = props.initialMode
    return
  }
  const preferences = await lifecycle.listNotificationPreferences().catch(() => [])
  mode.value = preferences.find(item => item.source_type === props.sourceType && item.source_id === props.sourceId)?.mode || 'feed_only'
})

async function save() {
  saving.value = true
  error.value = ''
  try {
    const preference = await lifecycle.saveNotificationPreference({ source_type: props.sourceType, source_id: props.sourceId, mode: mode.value })
    mode.value = preference.mode
  } catch {
    error.value = '保存失败'
  } finally {
    saving.value = false
  }
}

async function updateMode(value: string | number) {
  mode.value = value as ContentNotificationPreference['mode']
  await save()
}
</script>

<template>
  <div class="notification-mode" @click.stop>
    <PSelect
      :model-value="mode"
      :disabled="saving"
      label="更新提醒"
      :options="[
        { label: '仅订阅页', value: 'feed_only' },
        { label: '即时通知', value: 'all' },
        { label: '每日汇总', value: 'daily' },
      ]"
      @update:model-value="updateMode"
    />
    <small v-if="error" role="alert">{{ error }}</small>
  </div>
</template>

<style scoped>
.notification-mode { display: inline-grid; gap: 0.25rem; min-width: 7rem; }
.notification-mode :deep(.p-field) { gap: 0.25rem; min-width: 7rem; }
.notification-mode :deep(.p-field-label) { color: var(--a-color-muted); font-size: 0.7rem; font-weight: 400; }
.notification-mode :deep(.p-select-trigger) { min-height: 2.25rem; height: 2.25rem; max-width: 100%; padding: 0 0.5rem; font-size: 0.75rem; }
.notification-mode :deep(.p-select-trigger:focus-visible) { outline-color: var(--a-color-fg); }
.notification-mode small { color: var(--a-color-danger); font-size: 0.7rem; }
</style>
