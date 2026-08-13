<template>
  <div class="a-page">
    <PPageHeader :title="isEditing ? '编辑话题' : '发布话题'">
      <template #action>
        <PButton outline @click="router.back()">取消</PButton>
      </template>
    </PPageHeader>

    <div class="form-wrap">
      <!-- Category picker -->
      <div class="a-field">
        <label class="a-field-label">分类</label>
        <div v-if="!forumStore.categoriesLoaded" class="a-muted category-loading">
          加载中...
        </div>
        <div v-else-if="forumStore.categories.length === 0" class="a-muted empty-category-note">
          暂无分类，请联系管理员创建分类后再发帖
        </div>
        <div v-else class="category-grid">
          <PButton
            v-for="cat in forumStore.categories"
            :key="cat.id"
            outline
            size="sm"
            class="category-btn"
            :class="{ 'category-btn-selected': selectedCategoryId === cat.id }"
            :disabled="isEditing"
            @click="selectedCategoryId = cat.id"
          >
            <span class="category-dot" :style="{ background: cat.color || 'var(--a-color-fg)' }" />
            <span>{{ cat.name }}</span>
          </PButton>
        </div>
        <p v-if="errors.category" class="a-field-error">{{ errors.category }}</p>
      </div>

      <!-- Tag input -->
      <div class="a-field">
        <label class="a-field-label">
          标签
          <span class="field-label-meta">（可选，回车或逗号添加）</span>
        </label>
        <div class="tag-input-wrap">
          <span
            v-for="(tag, i) in tags"
            :key="i"
            class="tag-chip a-badge a-badge-fill"
          >
            {{ tag }}
            <button type="button" class="tag-remove" @click="removeTag(i)">×</button>
          </span>
          <input
            ref="tagInputRef"
            v-model="tagInput"
            type="text"
            placeholder="输入标签..."
            class="tag-input"
            @keydown.enter.prevent="addTag"
            @keydown.comma.prevent="addTag"
            @keydown.backspace="onTagBackspace"
          />
        </div>
      </div>

      <!-- Editor (title + content) -->
      <div class="a-field">
        <label class="a-field-label">
          标题 &amp; 正文
          <span v-if="draftSavedAt" class="field-label-meta field-label-saved">
            — 草稿已保存 {{ draftSavedAt }}
          </span>
        </label>
        <div class="editor-wrap" :class="{ 'editor-error': !!errors.editor }">
          <PEditor
            v-model="editorValue"
            :mode="editorMode"
            :enable-mentions="true"
            :show-mode-toggle="true"
            :show-sync-scroll-toggle="true"
            :sync-scroll="syncScroll"
            placeholder="话题标题…"
            @mode-change="editorMode = $event"
            @update:sync-scroll="syncScroll = $event"
          />
        </div>
        <p v-if="errors.editor" class="a-field-error">{{ errors.editor }}</p>
      </div>

      <!-- Submit -->
      <div class="form-actions">
        <PButton :disabled="submitting" @click="submit">
          {{ submitting ? (isEditing ? '保存中...' : '发布中...') : (isEditing ? '保存修改' : '发布话题') }}
        </PButton>
        <PButton outline @click="router.back()">取消</PButton>
        <PButton v-if="hasDraft" outline size="sm" @click="clearDraft">清除草稿</PButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEditor from '@/components/shared/PEditor.vue'
import { useForumStore } from '@/stores/forum'
import { useAuthStore } from '@/stores/auth'
import type { ForumDraft } from '@/types'

const route = useRoute()
const router = useRouter()
const forumStore = useForumStore()
const authStore = useAuthStore()
const isEditing = computed(() => Boolean(route.params.id && route.params.id !== 'new'))
const topicId = computed(() => String(route.params.id || ''))
const DRAFT_KEY = computed(() => isEditing.value ? `edit_topic:${topicId.value}` : 'new_topic')

const selectedCategoryId = ref('')
const editorValue = ref('')
const editorMode = ref<'normal' | 'split'>('normal')
const syncScroll = ref(true)
const tags = ref<string[]>([])
const tagInput = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const errors = ref({ category: '', editor: '' })
const draftSavedAt = ref('')
const hasDraft = ref(false)

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let autosaveEnabled = false

// ─── Tag management ──────────────────────────────────────────────────────────

const addTag = () => {
  const val = tagInput.value.replace(/,/g, '').trim()
  if (val && !tags.value.includes(val) && tags.value.length < 5) {
    tags.value.push(val)
  }
  tagInput.value = ''
}

const removeTag = (index: number) => {
  tags.value.splice(index, 1)
}

const onTagBackspace = () => {
  if (tagInput.value === '' && tags.value.length > 0) {
    tags.value.pop()
  }
}

// ─── Draft persistence ───────────────────────────────────────────────────────

const saveDraft = async () => {
  const { title, content } = parseEditor()
  if (!title && !content) return
  const draft: ForumDraft = {
    context_key: DRAFT_KEY.value,
    title,
    content,
    tags: tags.value.join(','),
  }
  forumStore.saveDraftLocal(DRAFT_KEY.value, draft)
  await forumStore.putDraft(draft)
  const now = new Date()
  draftSavedAt.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  hasDraft.value = true
}

const restoreDraft = async () => {
  const draft = await forumStore.fetchDraft(DRAFT_KEY.value) ?? forumStore.loadDraftLocal(DRAFT_KEY.value)
  if (!draft) return
  if (draft.content) {
    const titleLine = draft.title ? `# ${draft.title}\n\n` : ''
    editorValue.value = titleLine + (draft.content || '')
  }
  if (draft.tags) {
    tags.value = draft.tags.split(',').filter(Boolean)
  }
  hasDraft.value = true
}

const clearDraft = async () => {
  await forumStore.deleteDraft(DRAFT_KEY.value)
  hasDraft.value = false
  draftSavedAt.value = ''
}

const scheduleAutosave = () => {
  if (!autosaveEnabled) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => { void saveDraft() }, 1000)
}

watch(() => [editorValue.value, selectedCategoryId.value, tags.value.join(',')], scheduleAutosave)

onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  if (autosaveEnabled) void saveDraft()
})

// ─── Submission ──────────────────────────────────────────────────────────────

function parseEditor(): { title: string; content: string } {
  const blocks = editorValue.value.split(/\n\n+/)
  const titleBlock = blocks[0] || ''
  const title = titleBlock.replace(/^#{1,6}\s*/, '').trim()
  const content = blocks.slice(1).join('\n\n').trim()
  return { title, content }
}

const validate = () => {
  let ok = true
  errors.value = { category: '', editor: '' }
  if (!selectedCategoryId.value) {
    errors.value.category = '请选择分类'
    ok = false
  }
  const { title, content } = parseEditor()
  if (!title) {
    errors.value.editor = '标题不能为空'
    ok = false
  } else if (!content) {
    errors.value.editor = '正文不能为空'
    ok = false
  }
  return ok
}

const submit = async () => {
  if (!validate()) return
  submitting.value = true
  try {
    const { title, content } = parseEditor()
    const topic = isEditing.value
      ? (await forumStore.updateTopic(topicId.value, { title, content, tags: tags.value })
        ? await forumStore.fetchTopic(topicId.value)
        : null)
      : await forumStore.createTopic({ category_id: selectedCategoryId.value, title, content, tags: tags.value })
    if (topic) {
      autosaveEnabled = false
      if (autosaveTimer) clearTimeout(autosaveTimer)
      await clearDraft()
      router.push(`/forum/topic/${topic.id}`)
    } else {
      errors.value.editor = forumStore.error || '发布失败，请重试'
    }
  } finally {
    submitting.value = false
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  if (!forumStore.categoriesLoaded) {
    await forumStore.fetchCategories()
  }
  if (forumStore.categories.length > 0 && !selectedCategoryId.value) {
    selectedCategoryId.value = forumStore.categories[0].id
  }
  if (isEditing.value) {
    const topic = await forumStore.fetchTopic(topicId.value)
    if (!topic) return
    selectedCategoryId.value = topic.category_id
    editorValue.value = `# ${topic.title}\n\n${topic.content}`
    tags.value = [...(topic.tags || [])]
  }
  await restoreDraft()
  autosaveEnabled = true
})
</script>

<style scoped>
.form-wrap {
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 2.25rem;
}

.field-label-meta {
  font-weight: var(--a-font-weight-normal);
  text-transform: none;
  letter-spacing: 0;
}

.field-label-saved {
  color: var(--a-color-muted);
}

.empty-category-note {
  padding: 0.5rem 0;
  font-size: 0.875rem;
  font-weight: var(--a-font-weight-strong);
}

.category-loading {
  font-size: 0.875rem;
}

/* Category grid */
.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.category-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: none;
}

.category-btn-selected {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}

.category-btn-selected .category-dot {
  outline: 2px solid var(--a-color-bg);
  outline-offset: 1px;
}

.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex-shrink: 0;
}

/* Tag input */
.tag-input-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  border: var(--a-border);
  padding: 0.5rem 0.75rem;
  background: var(--a-color-bg);
  min-height: 2.75rem;
  align-items: center;
  cursor: text;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.tag-remove {
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  margin-left: 0.1rem;
}

.tag-input {
  flex: 1;
  min-width: 120px;
  font-size: var(--a-text-sm);
  font-family: inherit;
  background: transparent;
  color: var(--a-color-fg);
}

/* Editor */
.editor-wrap {
  height: 520px;
  display: flex;
  flex-direction: column;
}

.editor-error :deep(.markdown-editor) {
  border-color: var(--a-color-danger);
}

/* Form actions */
.form-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

</style>
