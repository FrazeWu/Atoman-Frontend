<template>
  <div data-testid="studio-collection-manager" class="studio-collections">
    <header class="studio-collections__heading">
      <div>
        <h2>合集管理</h2>
        <p>{{ studio.unifiedCollections.length }} 个合集</p>
      </div>
      <PButton data-testid="new-collection" size="sm" @click="startCreate">
        <Plus :size="16" aria-hidden="true" />
        新建合集
      </PButton>
    </header>

    <form v-if="editing" class="studio-collections__form" @submit.prevent="saveCollection">
      <PInput
        v-model="draft.name"
        data-testid="collection-name"
        label="名称"
        placeholder="合集名称"
        :error="nameError"
      />
      <PTextarea
        v-model="draft.description"
        data-testid="collection-description"
        label="描述"
        placeholder="合集描述"
        :rows="3"
      />
      <PInput
        v-model="draft.cover_url"
        data-testid="collection-cover-url"
        label="封面地址"
        placeholder="https://..."
      />
      <img
        v-if="draft.cover_url.trim() && !coverPreviewFailed"
        class="studio-collections__cover studio-collections__cover--preview"
        :src="draft.cover_url.trim()"
        alt="合集封面预览"
        @error="coverPreviewFailed = true"
      />
      <p v-else-if="draft.cover_url.trim()" class="studio-collections__cover-error">无法加载该封面地址</p>
      <div class="studio-collections__form-actions">
        <PButton data-testid="cancel-collection" type="button" variant="ghost" size="sm" @click="cancelEdit">取消</PButton>
        <PButton data-testid="save-collection" type="button" size="sm" :loading="saving" @click="saveCollection">保存</PButton>
      </div>
    </form>

    <p v-if="error" class="studio-collections__error" role="alert">{{ error }}</p>

    <ul v-if="studio.unifiedCollections.length" class="studio-collections__list">
      <li v-for="collection in studio.unifiedCollections" :key="collection.id">
        <img
          v-if="collection.cover_url && !failedCollectionCovers.has(collection.cover_url)"
          class="studio-collections__cover"
          :src="collection.cover_url"
          :alt="`${collection.name}封面`"
          @error="markCollectionCoverFailed(collection.cover_url)"
        />
        <div class="studio-collections__identity">
          <div class="studio-collections__name">
            <RouterLink :to="`/studio/manage/collections/${collection.id}`">{{ collection.name }}</RouterLink>
            <span v-if="collection.is_default">默认合集</span>
          </div>
          <p v-if="collection.description">{{ collection.description }}</p>
        </div>
        <div class="studio-collections__actions">
          <button
            type="button"
            :data-testid="`edit-collection-${collection.id}`"
            :aria-label="`编辑${collection.name}`"
            :title="`编辑${collection.name}`"
            @click="startEdit(collection)"
          >
            <Pencil :size="17" aria-hidden="true" />
          </button>
          <button
            v-if="!collection.is_default"
            type="button"
            :data-testid="`delete-collection-${collection.id}`"
            :aria-label="`删除${collection.name}`"
            :title="`删除${collection.name}`"
            @click="pendingDelete = collection"
          >
            <Trash2 :size="17" aria-hidden="true" />
          </button>
        </div>
      </li>
    </ul>
    <PEmpty v-else kicker="" title="暂无合集" />
  </div>

  <PModal v-model="deleteModalOpen" title="删除合集" size="sm">
    <p class="studio-collections__confirm">确定删除“{{ pendingDelete?.name }}”吗？内容不会被删除。</p>
    <template #footer>
      <PButton variant="secondary" @click="pendingDelete = null">取消</PButton>
      <PButton
        data-testid="confirm-delete-collection"
        variant="danger"
        :loading="deleting"
        @click="deleteCollection"
      >
        删除
      </PButton>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { IconPencil as Pencil, IconPlus as Plus, IconTrash as Trash2 } from '@tabler/icons-vue'

import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useStudioStore } from '@/stores/studio'
import type { StudioCollection } from '@/types'

const emit = defineEmits<{ changed: [] }>()
const studio = useStudioStore()
const editing = ref(false)
const editingID = ref('')
const saving = ref(false)
const deleting = ref(false)
const nameError = ref('')
const error = ref('')
const pendingDelete = ref<StudioCollection | null>(null)
const deleteModalOpen = computed({
  get: () => pendingDelete.value !== null,
  set: value => { if (!value) pendingDelete.value = null },
})
const draft = reactive({ name: '', description: '', cover_url: '' })
const coverPreviewFailed = ref(false)
const failedCollectionCovers = ref(new Set<string>())

watch(editing, () => {
  if (!editing.value) pendingDelete.value = null
})

watch(() => draft.cover_url, () => {
  coverPreviewFailed.value = false
})

watch(() => studio.currentChannel?.id, () => {
  resetDraft()
  pendingDelete.value = null
  error.value = ''
})

function resetDraft() {
  editing.value = false
  editingID.value = ''
  draft.name = ''
  draft.description = ''
  draft.cover_url = ''
  coverPreviewFailed.value = false
  nameError.value = ''
}

function startCreate() {
  resetDraft()
  error.value = ''
  editing.value = true
}

function startEdit(collection: StudioCollection) {
  editing.value = true
  editingID.value = collection.id
  draft.name = collection.name
  draft.description = collection.description || ''
  draft.cover_url = collection.cover_url || ''
  coverPreviewFailed.value = false
  nameError.value = ''
  error.value = ''
}

function cancelEdit() {
  resetDraft()
}

function markCollectionCoverFailed(url: string) {
  failedCollectionCovers.value = new Set([...failedCollectionCovers.value, url])
}

async function saveCollection() {
  const name = draft.name.trim()
  if (!name) {
    nameError.value = '请输入合集名称'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const input = { name, description: draft.description.trim(), cover_url: draft.cover_url.trim() }
    if (editingID.value) await studio.updateUnifiedCollection(editingID.value, input)
    else await studio.createUnifiedCollection(input)
    resetDraft()
    emit('changed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function deleteCollection() {
  if (!pendingDelete.value || pendingDelete.value.is_default) return
  deleting.value = true
  error.value = ''
  const collection = pendingDelete.value
  try {
    await studio.deleteUnifiedCollection(collection.id)
    pendingDelete.value = null
    emit('changed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '删除失败'
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.studio-collections { display: grid; gap: 1rem; }
.studio-collections__heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-collections__heading h2, .studio-collections__heading p { margin: 0; }
.studio-collections__heading h2 { font-size: 1.125rem; }
.studio-collections__heading p { margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.studio-collections__form { display: grid; gap: 0.875rem; padding: 1.25rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.studio-collections__form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.studio-collections__error, .studio-collections__confirm { margin: 0; }
.studio-collections__error { color: var(--a-color-danger); }
.studio-collections__list { display: grid; gap: 0.75rem; margin: 0; padding: 0; list-style: none; }
.studio-collections__list li { min-height: 72px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding: 1rem 1.125rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); transition: border-color 0.18s ease, box-shadow 0.18s ease; }
.studio-collections__cover { width: 3.5rem; height: 3.5rem; object-fit: cover; border-radius: var(--a-radius-control); background: var(--a-color-surface-muted); }
.studio-collections__cover--preview { width: min(12rem, 100%); height: auto; aspect-ratio: 16 / 9; }
.studio-collections__cover-error { margin: 0; color: var(--a-color-danger); font-size: 0.8rem; }
.studio-collections__list li:hover { border-color: var(--a-color-border); box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05); }
.studio-collections__identity { min-width: 0; }
.studio-collections__name { display: flex; align-items: center; gap: 0.5rem; }
.studio-collections__name a { min-width: 0; color: var(--a-color-text); font-weight: 650; overflow: hidden; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.studio-collections__name a:hover { color: var(--a-color-primary); }
.studio-collections__name span { padding: 0.15rem 0.4rem; background: var(--a-color-surface-muted); color: var(--a-color-muted); font-size: 0.7rem; }
.studio-collections__list strong, .studio-collections__list p { margin: 0; }
.studio-collections__list p { margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.8rem; line-height: 1.4; }
.studio-collections__actions { display: flex; gap: 0.5rem; }
.studio-collections__actions button { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-text); cursor: pointer; }
.studio-collections__actions button:hover { background: var(--a-color-surface-muted); }
.studio-collections__actions button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
@media (max-width: 560px) {
  .studio-collections__heading { align-items: stretch; flex-direction: column; }
  .studio-collections__heading :deep(.p-button) { width: 100%; }
  .studio-collections__list li { align-items: start; grid-template-columns: auto minmax(0, 1fr); padding: 1rem; }
  .studio-collections__actions { grid-column: 1 / -1; justify-content: flex-end; width: 100%; }
}
</style>
