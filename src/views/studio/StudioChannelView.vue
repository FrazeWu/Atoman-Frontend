<template>
  <section class="studio-channels">
    <header class="studio-channels__header">
      <h1>频道设置</h1>
      <PButton data-testid="new-channel" size="sm" @click="startCreate">
        <Plus :size="16" aria-hidden="true" /> 新建频道
      </PButton>
    </header>

    <form v-if="editing" class="studio-channels__form" @submit.prevent="saveChannel">
      <PInput v-model="draft.name" data-testid="channel-name" label="名称" placeholder="频道名称" :error="nameError" />
      <PInput v-model="draft.slug" data-testid="channel-slug" label="地址标识" placeholder="channel-name" />
      <PTextarea v-model="draft.description" label="简介" placeholder="频道简介" :rows="3" />
      <PInput v-model="draft.cover_url" label="封面地址" placeholder="https://..." />
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
          <strong>{{ channel.name }}</strong>
          <span v-if="channel.id === studio.currentChannel?.id">当前频道</span>
          <p v-if="channel.description">{{ channel.description }}</p>
          <small>/{{ channel.slug }}</small>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import { apiDeleteJson, apiPatchJson, apiPostJson } from '@/api/client'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useApi } from '@/composables/useApi'
import { useStudioStore } from '@/stores/studio'
import type { StudioChannel } from '@/types'

const api = useApi().studio
const router = useRouter()
const studio = useStudioStore()
const editing = ref(false)
const editingID = ref('')
const saving = ref(false)
const deleting = ref(false)
const nameError = ref('')
const error = ref('')
const pendingDelete = ref<StudioChannel | null>(null)
const draft = reactive({ name: '', slug: '', description: '', cover_url: '' })
const deleteModalOpen = computed({
  get: () => pendingDelete.value !== null,
  set: value => { if (!value) pendingDelete.value = null },
})

function resetDraft() {
  editing.value = false
  editingID.value = ''
  draft.name = ''
  draft.slug = ''
  draft.description = ''
  draft.cover_url = ''
  nameError.value = ''
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
  draft.slug = channel.slug
  draft.description = channel.description || ''
  draft.cover_url = channel.cover_url || ''
  nameError.value = ''
  error.value = ''
}

function cancelEdit() {
  resetDraft()
}

async function saveChannel() {
  const name = draft.name.trim()
  if (!name) {
    nameError.value = '请输入频道名称'
    return
  }
  const input = {
    name,
    slug: draft.slug.trim(),
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
    if (firstChannel) await router.push('/studio')
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
</script>

<style scoped>
.studio-channels { display: grid; gap: 1rem; max-width: 54rem; }
.studio-channels__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.studio-channels h1, .studio-channels__error, .studio-channels__confirm { margin: 0; }
.studio-channels h1 { font-size: 1.5rem; }
.studio-channels__form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; padding: 1rem 0; border-block: 1px solid var(--a-color-border-soft); }
.studio-channels__form > :nth-child(n + 3) { grid-column: 1 / -1; }
.studio-channels__form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.studio-channels__error { color: var(--a-color-danger); }
.studio-channels__list { display: grid; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--a-color-border-soft); }
.studio-channels__list li { min-height: 6rem; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 1rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-channels__identity { min-width: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.6rem; align-items: center; }
.studio-channels__identity > span { width: max-content; padding: 0.15rem 0.4rem; background: var(--a-color-surface-muted); color: var(--a-color-muted); font-size: 0.7rem; }
.studio-channels__identity p, .studio-channels__identity small { grid-column: 1 / -1; margin: 0; color: var(--a-color-muted); }
.studio-channels__identity p { font-size: 0.8rem; line-height: 1.4; }
.studio-channels__identity small { font-size: 0.7rem; }
.studio-channels__actions { display: flex; align-items: center; gap: 0.5rem; }
.studio-channels__actions > button:not(.p-button) { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-text); cursor: pointer; }
.studio-channels__actions > button:not(.p-button):hover { background: var(--a-color-surface-muted); }
.studio-channels__actions > button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
@media (max-width: 640px) {
  .studio-channels__form { grid-template-columns: 1fr; }
  .studio-channels__form > * { grid-column: auto !important; }
  .studio-channels__list li { align-items: start; grid-template-columns: 1fr; padding: 1rem 0; }
  .studio-channels__actions { justify-content: flex-end; }
}
</style>
