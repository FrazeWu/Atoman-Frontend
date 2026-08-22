<template>
  <section class="studio-settings">
    <header class="studio-settings__header">
      <div>
        <h2>设置</h2>
        <p>配置新内容的默认发布与互动选项。</p>
      </div>
    </header>
    <p v-if="loading" class="studio-settings__message">加载中...</p>
    <p v-else-if="error" class="studio-settings__message" role="alert">{{ error }}</p>
    <form v-else class="studio-settings__form" @submit.prevent="save">
      <section class="studio-settings__block studio-settings__defaults">
        <header>
          <h3>发布默认值</h3>
          <p>创建内容时会自动使用这些选项。</p>
        </header>
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
      </section>
      <section v-if="module !== 'blog'" class="studio-settings__block">
        <header>
          <h3>播放行为</h3>
          <p>控制播放结束后的下一步。</p>
        </header>
        <label class="studio-settings__toggle">
          <span>
            <strong>连续播放</strong>
            <small>播放结束后自动进入下一项</small>
          </span>
          <input v-model="form.autoplay_enabled" data-testid="autoplay-setting" type="checkbox">
        </label>
      </section>
      <section v-if="studio.currentChannel" class="studio-settings__block">
        <header>
          <h3>私信权限</h3>
          <p>控制频道收到私信的方式。</p>
        </header>
        <DMSettingsPanel :subject="{ type: 'channel', id: studio.currentChannel.id }" />
      </section>
      <div class="studio-settings__actions">
        <span v-if="saved" role="status">已保存</span>
        <PButton data-testid="save-settings" type="button" :loading="saving" @click="save">保存默认值</PButton>
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
  default_publish_status: 'draft' as StudioPublishStatus,
  autoplay_enabled: false,
})

function applySettings() {
  const settings = studio.settings[module.value]
  form.default_collection_id = settings?.default_collection_id || ''
  form.default_visibility = settings?.default_visibility || 'public'
  form.default_publish_status = settings?.default_publish_status || 'draft'
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
.studio-settings { display: grid; gap: 1.25rem; max-width: 48rem; }
.studio-settings__header h2, .studio-settings__header p, .studio-settings__message { margin: 0; }
.studio-settings__header h2 { font-size: 1.25rem; }
.studio-settings__header p { margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.8125rem; }
.studio-settings__message { color: var(--a-color-muted); padding: 2rem 0; }
.studio-settings__form { display: grid; gap: 1rem; border: 0; }
.studio-settings__block { display: grid; gap: 0; padding: 1.125rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.studio-settings__block > header { display: grid; gap: 0.25rem; padding-bottom: 0.875rem; }
.studio-settings__block h3, .studio-settings__block p { margin: 0; }
.studio-settings__block h3 { font-size: 0.95rem; }
.studio-settings__block header p { color: var(--a-color-muted); font-size: 0.8rem; }
.studio-settings__defaults > .studio-settings__field { min-height: 4.5rem; display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(14rem, 1fr); align-items: center; gap: 1rem; border-top: 1px solid var(--a-color-border-soft); }
.studio-settings__field :deep(.p-field-label) { color: var(--a-color-text); font-size: 0.875rem; font-weight: 600; }
.studio-settings__toggle { min-height: 4rem; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 1rem; border-top: 1px solid var(--a-color-border-soft); }
.studio-settings__toggle > span { display: grid; gap: 0.25rem; }
.studio-settings__toggle small { color: var(--a-color-muted); font-size: 0.75rem; font-weight: 400; }
.studio-settings__toggle input { justify-self: end; width: 1.25rem; height: 1.25rem; accent-color: var(--a-color-primary); }
.studio-settings__actions { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; padding-top: 1rem; }
.studio-settings__actions span { color: var(--a-color-muted); font-size: 0.8rem; }
@media (max-width: 560px) {
  .studio-settings__defaults > .studio-settings__field { grid-template-columns: 1fr; gap: 0.5rem; padding: 0.75rem 0; }
  .studio-settings__toggle { grid-template-columns: 1fr auto; }
}
</style>
