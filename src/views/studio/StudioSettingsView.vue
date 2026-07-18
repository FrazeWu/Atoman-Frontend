<template>
  <section class="studio-settings">
    <header><h2>设置</h2></header>
    <p v-if="loading" class="studio-settings__message">加载中...</p>
    <p v-else-if="error" class="studio-settings__message" role="alert">{{ error }}</p>
    <form v-else class="studio-settings__form" @submit.prevent="save">
      <label>
        <span>默认合集</span>
        <select v-model="form.default_collection_id" data-testid="default-collection-setting">
          <option value="">不预选</option>
          <option v-for="collection in studio.collections[module]" :key="collection.id" :value="collection.id">
            {{ collection.name }}
          </option>
        </select>
      </label>
      <label>
        <span>默认可见范围</span>
        <select v-model="form.default_visibility" data-testid="visibility-setting">
          <option value="public">公开</option>
          <option value="subscribers">订阅者</option>
          <option value="private">私密</option>
        </select>
      </label>
      <label>
        <span>默认发布状态</span>
        <select v-model="form.default_publish_status" data-testid="publish-status-setting">
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
      </label>
      <label v-if="module !== 'blog'" class="studio-settings__toggle">
        <span>
          <strong>连续播放</strong>
          <small>播放结束后自动进入下一项</small>
        </span>
        <input v-model="form.autoplay_enabled" data-testid="autoplay-setting" type="checkbox">
      </label>
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
    await studio.saveSettings(module.value, input)
    saved.value = true
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
.studio-settings__form > label { min-height: 5rem; display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(14rem, 1fr); align-items: center; gap: 1rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-settings__form > label > span { font-size: 0.875rem; font-weight: 600; }
.studio-settings select { min-height: 44px; width: 100%; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-bg); color: var(--a-color-text); padding: 0 2rem 0 0.75rem; font: inherit; }
.studio-settings select:focus-visible, .studio-settings input:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.studio-settings__toggle > span { display: grid; gap: 0.25rem; }
.studio-settings__toggle small { color: var(--a-color-muted); font-size: 0.75rem; font-weight: 400; }
.studio-settings__toggle input { justify-self: end; width: 1.25rem; height: 1.25rem; accent-color: var(--a-color-primary); }
.studio-settings__actions { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; padding-top: 1rem; }
.studio-settings__actions span { color: var(--a-color-muted); font-size: 0.8rem; }
@media (max-width: 560px) {
  .studio-settings__form > label { grid-template-columns: 1fr; gap: 0.5rem; padding: 0.75rem 0; }
  .studio-settings__toggle { grid-template-columns: 1fr auto !important; }
}
</style>
