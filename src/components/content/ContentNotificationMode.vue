<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useContentLifecycle, type ContentNotificationPreference } from '@/composables/useContentLifecycle'

const props = defineProps<{ sourceType: ContentNotificationPreference['source_type']; sourceId: string }>()
const lifecycle = useContentLifecycle()
const mode = ref<ContentNotificationPreference['mode']>('feed_only')
const saving = ref(false)
const error = ref('')

onMounted(async () => {
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
</script>

<template>
  <label class="notification-mode" @click.stop>
    <span>更新提醒</span>
    <select v-model="mode" :disabled="saving" @change="save">
      <option value="feed_only">仅订阅页</option>
      <option value="all">即时通知</option>
      <option value="daily">每日汇总</option>
    </select>
    <small v-if="error" role="alert">{{ error }}</small>
  </label>
</template>

<style scoped>
.notification-mode { display: inline-grid; gap: 0.25rem; min-width: 7rem; }
.notification-mode > span { color: var(--a-color-muted); font-size: 0.7rem; }
.notification-mode select { min-height: 2.25rem; max-width: 100%; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-fg); padding: 0 0.5rem; font: inherit; font-size: 0.75rem; }
.notification-mode select:focus-visible { outline: 2px solid var(--a-color-fg); outline-offset: 2px; }
.notification-mode small { color: var(--a-color-danger); font-size: 0.7rem; }
</style>
