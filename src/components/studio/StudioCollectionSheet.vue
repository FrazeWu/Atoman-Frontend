<template>
  <PSheet
    :show="show"
    :title="`${config.label}合集`"
    width="min(100%, 520px)"
    close-type="header"
    @close="$emit('close')"
  >
    <template #header>
      <div class="studio-collections__header">
        <strong>{{ config.label }}合集</strong>
        <PButton data-testid="new-collection" variant="secondary" size="sm" @click="startCreate">
          <Plus :size="16" aria-hidden="true" />
          新建
        </PButton>
      </div>
    </template>

    <div data-testid="studio-collection-sheet" class="studio-collections">
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
        <div class="studio-collections__form-actions">
          <PButton type="button" variant="ghost" size="sm" @click="cancelEdit">取消</PButton>
          <PButton data-testid="save-collection" type="button" size="sm" :loading="saving" @click="saveCollection">保存</PButton>
        </div>
      </form>

      <p v-if="error" class="studio-collections__error" role="alert">{{ error }}</p>

      <ul v-if="studio.collections[module].length" class="studio-collections__list">
        <li v-for="collection in studio.collections[module]" :key="collection.id">
          <div>
            <strong>{{ collection.name }}</strong>
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
  </PSheet>

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
import { computed, reactive, ref } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'

import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { studioModules } from '@/config/studioModules'
import { useStudioStore } from '@/stores/studio'
import type { StudioCollection, StudioModule } from '@/types'

const props = defineProps<{ show: boolean; module: StudioModule }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const studio = useStudioStore()
const config = computed(() => studioModules[props.module])
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
const draft = reactive({ name: '', description: '' })

function resetDraft() {
  editing.value = false
  editingID.value = ''
  draft.name = ''
  draft.description = ''
  nameError.value = ''
}

function startCreate() {
  resetDraft()
  editing.value = true
}

function startEdit(collection: StudioCollection) {
  editing.value = true
  editingID.value = collection.id
  draft.name = collection.name
  draft.description = collection.description || ''
  nameError.value = ''
  error.value = ''
}

function cancelEdit() {
  resetDraft()
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
    const input = { name, description: draft.description.trim() }
    if (editingID.value) await studio.updateCollection(props.module, editingID.value, input)
    else await studio.createCollection(props.module, input)
    resetDraft()
    emit('changed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function deleteCollection() {
  if (!pendingDelete.value) return
  deleting.value = true
  error.value = ''
  try {
    await studio.deleteCollection(props.module, pendingDelete.value.id)
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
.studio-collections__header { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.studio-collections { display: grid; gap: 1rem; padding: 1rem; }
.studio-collections__form { display: grid; gap: 0.875rem; padding-bottom: 1rem; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-collections__form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.studio-collections__error, .studio-collections__confirm { margin: 0; }
.studio-collections__error { color: var(--a-color-danger); }
.studio-collections__list { display: grid; margin: 0; padding: 0; list-style: none; }
.studio-collections__list li { min-height: 68px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--a-color-border-soft); }
.studio-collections__list strong, .studio-collections__list p { margin: 0; }
.studio-collections__list p { margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.8rem; line-height: 1.4; }
.studio-collections__actions { display: flex; gap: 0.5rem; }
.studio-collections__actions button { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-text); cursor: pointer; }
.studio-collections__actions button:hover { background: var(--a-color-surface-muted); }
.studio-collections__actions button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
</style>
