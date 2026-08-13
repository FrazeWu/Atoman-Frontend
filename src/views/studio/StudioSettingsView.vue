<template>
  <section class="studio-settings">
    <header><h2>设置</h2></header>
    <p v-if="loading" class="studio-settings__message">加载中...</p>
    <p v-else-if="error" class="studio-settings__message" role="alert">{{ error }}</p>
    <form v-else class="studio-settings__form" @submit.prevent="save">
      <PSelect
        v-model="form.default_collection_id"
        class="studio-settings__field"
        data-testid="default-collection-setting"
        label="默认合集"
        :options="[
          { label: '不预选', value: '' },
          ...studio.collections[module].map(collection => ({ label: collection.name, value: collection.id })),
        ]"
      />
      <PSelect
        v-model="form.default_visibility"
        class="studio-settings__field"
        data-testid="visibility-setting"
        label="默认可见范围"
        :options="[
          { label: '公开', value: 'public' },
          { label: '订阅者', value: 'subscribers' },
          { label: '私密', value: 'private' },
        ]"
      />
      <PSelect
        v-model="form.default_publish_status"
        class="studio-settings__field"
        data-testid="publish-status-setting"
        label="默认发布状态"
        :options="[
          { label: '已发布', value: 'published' },
          { label: '草稿', value: 'draft' },
        ]"
      />
      <label v-if="module !== 'blog'" class="studio-settings__toggle">
        <span>
          <strong>连续播放</strong>
          <small>播放结束后自动进入下一项</small>
        </span>
        <input v-model="form.autoplay_enabled" data-testid="autoplay-setting" type="checkbox">
      </label>
      <DMSettingsPanel v-if="studio.currentChannel" :subject="{ type: 'channel', id: studio.currentChannel.id }" />
      <div class="studio-settings__actions">
        <span v-if="saved" role="status">已保存</span>
        <PButton data-testid="save-settings" type="button" :loading="saving" @click="save">保存</PButton>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import DMSettingsPanel from '@/components/dm/DMSettingsPanel.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioModule, StudioPublishStatus, StudioSettingsInput, StudioVisibility } from '@/types'

const route = useRoute()
const studio = useStudioStore()
const module = computed(() => route.params.module as StudioModule)
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const form = reactive({
  default_collection_id: '',
  default_visibility: 'public' as StudioVisibility,
  default_publish_status: 'published' as StudioPublishStatus,
  autoplay_enabled: false,
})

function applySettings() {
  const settings = studio.settings[module.value]
  form.default_collection_id = settings?.default_collection_id || ''
  form.default_visibility = settings?.default_visibility || 'public'
  form.default_publish_status = settings?.default_publish_status || 'published'
  form.autoplay_enabled = module.value === 'blog' ? false : Boolean(settings?.autoplay_enabled)
}

async function loadSettings() {
  if (!studio.currentChannel) return
  loading.value = true
  error.value = ''
  try {
    await Promise.all([studio.loadCollections(module.value), studio.loadSettings(module.value)])
    applySettings()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const input: StudioSettingsInput = {
      default_collection_id: form.default_collection_id || null,
      default_visibility: form.default_visibility,
      default_publish_status: form.default_publish_status,
      autoplay_enabled: module.value === 'blog' ? false : form.autoplay_enabled,
    }
    saved.value = await studio.saveSettings(module.value, input)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await studio.loadState()
    await loadSettings()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
    loading.value = false
  }
})

watch(module, () => void loadSettings())
</script>

<style scoped>
.studio-settings { display: grid; gap: 1rem; max-width: 44rem; }
.studio-settings h2, .studio-settings__message { margin: 0; }
.studio-settings h2 { font-size: 1.125rem; }
.studio-settings__message { color: var(--a-color-muted); padding: 2rem 0; }
.studio-settings__form { display: grid; border-top: 1px solid var(--a-color-border-soft); }
.studio-settings__form > .studio-settings__field, .studio-settings__form > label { min-height: 5rem; display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(14rem, 1fr); align-items: center; gap: 1rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-settings__field :deep(.p-field-label) { color: var(--a-color-text); font-size: 0.875rem; font-weight: 600; }
.studio-settings__toggle > span { display: grid; gap: 0.25rem; }
.studio-settings__toggle small { color: var(--a-color-muted); font-size: 0.75rem; font-weight: 400; }
.studio-settings__toggle input { justify-self: end; width: 1.25rem; height: 1.25rem; accent-color: var(--a-color-primary); }
.studio-settings__actions { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; padding-top: 1rem; }
.studio-settings__actions span { color: var(--a-color-muted); font-size: 0.8rem; }
@media (max-width: 560px) {
  .studio-settings__form > .studio-settings__field { grid-template-columns: 1fr; gap: 0.5rem; padding: 0.75rem 0; }
  .studio-settings__toggle { grid-template-columns: 1fr auto !important; }
}
</style>
