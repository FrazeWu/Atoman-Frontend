<template>
  <section class="studio-channels">
    <PPageHeader title="频道管理" sub="管理内容发布使用的频道与地址。" mb="0">
      <template #action>
        <PButton data-testid="new-channel" size="sm" @click="startCreate">
          <Plus :size="16" aria-hidden="true" /> 新建频道
        </PButton>
      </template>
    </PPageHeader>

    <form v-if="editing" class="studio-channels__form" @submit.prevent="saveChannel">
      <PInput v-model="draft.name" data-testid="channel-name" label="名称" placeholder="频道名称" :error="nameError" />
      <div class="studio-channels__readonly-field">
        <span class="studio-channels__field-label">UUID</span>
        <code data-testid="channel-uuid">{{ editingID || '保存后生成' }}</code>
        <p>系统生成的频道唯一标识，不可修改。</p>
      </div>
      <PTextarea v-model="draft.description" label="简介" placeholder="频道简介" :rows="3" />
      <div class="studio-channels__cover-field">
        <span class="studio-channels__field-label">封面</span>
        <PostCoverField
          :cover-url="coverPreviewUrl"
          :uploading="coverUploading"
          :error="coverUploadError"
          @trigger-upload="triggerCoverUpload"
          @remove-cover="removeCover"
        />
        <input
          ref="coverInput"
          class="studio-channels__cover-input"
          data-testid="channel-cover-input"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          :disabled="coverUploading"
          @change="handleCoverUpload"
        />
      </div>
      <div class="studio-channels__form-actions">
        <PButton type="button" variant="ghost" @click="cancelEdit">取消</PButton>
        <PButton data-testid="save-channel" type="button" :loading="saving" @click="saveChannel">保存</PButton>
      </div>
    </form>

    <p v-if="error" class="studio-channels__error" role="alert">{{ error }}</p>
    <PEmpty v-if="!studio.channels.length && !editing" kicker="" title="暂无频道" />
    <ul v-else-if="studio.channels.length" class="studio-channels__list">
      <li v-for="channel in studio.channels" :key="channel.id">
        <div class="studio-channels__identity">
          <img v-if="channel.cover_url" :src="channel.cover_url" :alt="`${channel.name} 封面`" class="studio-channels__cover-thumb" loading="lazy" />
          <strong>{{ channel.name }}</strong>
          <span v-if="channel.id === studio.currentChannel?.id">当前频道</span>
          <p v-if="channel.description">{{ channel.description }}</p>
          <small>UUID：{{ channel.id }}</small>
        </div>
        <div class="studio-channels__actions">
          <PButton
            v-if="channel.id !== studio.currentChannel?.id"
            :data-testid="`select-channel-${channel.id}`"
            variant="secondary"
            size="sm"
            @click="selectChannel(channel.id)"
          >设为当前</PButton>
          <button
            type="button"
            :data-testid="`edit-channel-${channel.id}`"
            :aria-label="`编辑${channel.name}`"
            :title="`编辑${channel.name}`"
            @click="startEdit(channel)"
          >
            <Pencil :size="17" aria-hidden="true" />
          </button>
          <button
            type="button"
            :data-testid="`delete-channel-${channel.id}`"
            :aria-label="`删除${channel.name}`"
            :title="`删除${channel.name}`"
            @click="pendingDelete = channel"
          >
            <Trash2 :size="17" aria-hidden="true" />
          </button>
        </div>
      </li>
    </ul>
  </section>

  <PModal v-model="deleteModalOpen" title="删除频道" size="sm">
    <p class="studio-channels__confirm">只能删除没有内容的频道。确定删除“{{ pendingDelete?.name }}”吗？</p>
    <template #footer>
      <PButton variant="secondary" @click="pendingDelete = null">取消</PButton>
      <PButton data-testid="confirm-delete-channel" variant="danger" :loading="deleting" @click="deleteChannel">删除</PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { IconPencil as Pencil, IconPlus as Plus, IconTrash as Trash2 } from '@tabler/icons-vue'
import { useRoute, useRouter } from 'vue-router'

import { apiDeleteJson, apiPatchJson, apiPostJson, apiRequestResult } from '@/api/client'
import PostCoverField from '@/components/blog/PostCoverField.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PModal from '@/components/ui/PModal.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import type { StudioChannel } from '@/types'

const apiClient = useApi()
const api = apiClient.studio
const blogApi = apiClient.blog
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const studio = useStudioStore()
const editing = ref(false)
const editingID = ref('')
const saving = ref(false)
const deleting = ref(false)
const nameError = ref('')
const error = ref('')
const pendingDelete = ref<StudioChannel | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const coverPreviewUrl = ref('')
const coverObjectUrl = ref('')
const coverUploading = ref(false)
const coverUploadError = ref('')
const draft = reactive({ name: '', description: '', cover_url: '' })
const deleteModalOpen = computed({
  get: () => pendingDelete.value !== null,
  set: value => { if (!value) pendingDelete.value = null },
})

function resetDraft() {
  clearCoverPreview()
  editing.value = false
  editingID.value = ''
  draft.name = ''
  draft.description = ''
  draft.cover_url = ''
  nameError.value = ''
  coverUploadError.value = ''
}

function clearCoverPreview() {
  if (coverObjectUrl.value) URL.revokeObjectURL(coverObjectUrl.value)
  coverObjectUrl.value = ''
  coverPreviewUrl.value = ''
}

function setCoverPreview(url: string, objectUrl = false) {
  if (coverObjectUrl.value) URL.revokeObjectURL(coverObjectUrl.value)
  coverObjectUrl.value = objectUrl ? url : ''
  coverPreviewUrl.value = url
}

function startCreate() {
  resetDraft()
  error.value = ''
  editing.value = true
}

function startEdit(channel: StudioChannel) {
  editing.value = true
  editingID.value = channel.id
  draft.name = channel.name
  draft.description = channel.description || ''
  draft.cover_url = channel.cover_url || ''
  setCoverPreview(draft.cover_url)
  coverUploadError.value = ''
  nameError.value = ''
  error.value = ''
}

function cancelEdit() {
  resetDraft()
}

function triggerCoverUpload() {
  coverInput.value?.click()
}

async function handleCoverUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  if (!allowedTypes.has(file.type)) {
    coverUploadError.value = '只支持 JPEG、PNG、GIF、WebP 格式的图片'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    coverUploadError.value = '图片不能超过 5MB'
    return
  }
  if (!authStore.isAuthenticated) {
    coverUploadError.value = '请先登录后再上传封面'
    return
  }

  const previousUrl = draft.cover_url
  const previewUrl = URL.createObjectURL(file)
  setCoverPreview(previewUrl, true)
  coverUploading.value = true
  coverUploadError.value = ''
  try {
    const formData = new FormData()
    formData.append('image', file)
    const response = await apiRequestResult(blogApi.uploadImage, {
      method: 'POST',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : undefined,
      body: formData,
    })
    const payload = await Promise.resolve(response.data).catch(() => null) as { url?: unknown; error?: unknown } | null
    if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : '封面上传失败')
    if (typeof payload?.url !== 'string' || !payload.url) throw new Error('服务器没有返回封面地址')
    draft.cover_url = payload.url
    setCoverPreview(payload.url)
  } catch (cause) {
    setCoverPreview(previousUrl)
    coverUploadError.value = cause instanceof Error ? cause.message : '封面上传失败'
  } finally {
    coverUploading.value = false
  }
}

function removeCover() {
  draft.cover_url = ''
  clearCoverPreview()
  coverUploadError.value = ''
}

async function saveChannel() {
  if (coverUploading.value) return
  const name = draft.name.trim()
  if (!name) {
    nameError.value = '请输入频道名称'
    return
  }
  const input = {
    name,
    slug: '',
    description: draft.description.trim(),
    cover_url: draft.cover_url.trim(),
  }
  const firstChannel = studio.channels.length === 0
  saving.value = true
  error.value = ''
  try {
    if (editingID.value) await apiPatchJson<StudioChannel>(api.channel(editingID.value), input)
    else await apiPostJson<StudioChannel>(api.channels, input)
    resetDraft()
    await studio.loadState(true)
    if (firstChannel) {
      const returnTo = typeof route.query.return_to === 'string' ? route.query.return_to : ''
      await router.push(returnTo.startsWith('/studio/') ? returnTo : '/studio')
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function selectChannel(id: string) {
  error.value = ''
  try {
    await studio.selectChannel(id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '切换失败'
  }
}

async function deleteChannel() {
  if (!pendingDelete.value) return
  deleting.value = true
  error.value = ''
  try {
    await apiDeleteJson<{ message: string }>(api.channel(pendingDelete.value.id))
    pendingDelete.value = null
    await studio.loadState(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '删除失败'
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  if (!studio.loaded) void studio.loadState()
})

onBeforeUnmount(clearCoverPreview)
</script>

<style scoped>
.studio-channels { display: grid; gap: 1.25rem; max-width: 60rem; }
.studio-channels__form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}
.studio-channels__form > :nth-child(n + 3) { grid-column: 1 / -1; }
.studio-channels__cover-field { display: grid; gap: 0.5rem; grid-column: 1 / -1; }
.studio-channels__field-label { color: var(--a-color-muted); font-size: 0.8rem; font-weight: 600; }
.studio-channels__readonly-field { display: grid; gap: 0.35rem; grid-column: 1 / -1; }
.studio-channels__readonly-field code { width: fit-content; max-width: 100%; overflow-wrap: anywhere; color: var(--a-color-text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; }
.studio-channels__readonly-field p { margin: 0; color: var(--a-color-muted); font-size: 0.75rem; }
.studio-channels__cover-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.studio-channels__form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; grid-column: 1 / -1; padding-top: 0.25rem; }
.studio-channels__error { margin: 0; padding: 0.75rem 1rem; border: 1px solid var(--a-color-danger-border); border-radius: var(--a-radius-card); background: color-mix(in srgb, var(--a-color-danger) 5%, var(--a-color-bg)); color: var(--a-color-danger); }
.studio-channels__confirm { margin: 0; }
.studio-channels__list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.studio-channels__list li {
  min-height: 6rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.125rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.studio-channels__list li:hover { border-color: var(--a-color-border); box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
.studio-channels__identity { min-width: 0; display: grid; grid-template-columns: auto auto 1fr; gap: 0.25rem 0.6rem; align-items: center; }
.studio-channels__cover-thumb { width: 3rem; height: 3rem; border-radius: var(--a-radius-control); object-fit: cover; grid-row: span 2; }
.studio-channels__identity > span {
  width: max-content;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-primary) 10%, var(--a-color-bg));
  color: var(--a-color-primary);
  font-size: 0.7rem;
  font-weight: 600;
}
.studio-channels__identity p, .studio-channels__identity small { grid-column: 1 / -1; margin: 0; color: var(--a-color-muted); }
.studio-channels__identity p { font-size: 0.8rem; line-height: 1.4; }
.studio-channels__identity small { font-size: 0.7rem; }
.studio-channels__actions { display: flex; align-items: center; gap: 0.5rem; }
.studio-channels__actions > button:not(.p-button) { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-text); cursor: pointer; }
.studio-channels__actions > button:not(.p-button):hover { background: var(--a-color-surface-muted); }
.studio-channels__actions > button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
@media (max-width: 640px) {
  .studio-channels__form { grid-template-columns: 1fr; padding: 1rem; }
  .studio-channels__form > * { grid-column: auto !important; }
  .studio-channels__form-actions { grid-column: 1 / -1 !important; }
  .studio-channels__list li { align-items: start; grid-template-columns: 1fr; padding: 1rem; }
  .studio-channels__identity { grid-template-columns: auto auto 1fr; }
  .studio-channels__actions { justify-content: flex-end; width: 100%; }
}
</style>
