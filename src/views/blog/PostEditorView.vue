<template>
  <div class="editor-page">
    <div class="editor-shell">
      <div v-if="error" class="editor-error a-error">{{ error }}</div>

      <div
        class="editor-layout"
        :class="{
          'has-settings-panel': settingsPanelOpen,
          'has-outline-panel': outlinePanelOpen,
        }"
      >
        <PostEditorSidebar
          :mobile-open="mobilePanel === 'settings'"
          :desktop-open="settingsPanelOpen"
          :channel-collections="channelCollections"
          :selected-collection-id="selectedNonDefaultCollectionId"
          :default-collection-id="defaultCollectionId"
          :summary="form.summary"
          :visibility="form.visibility"
          :cover-url="form.cover_url"
          :cover-uploading="coverUploading"
          :cover-upload-error="coverUploadError"
          @select-collection="onCollectionSelect"
          @update:summary="(value) => (form.summary = value)"
          @update:visibility="(value) => (form.visibility = value)"
          @cover-upload="handleCoverUpload"
          @remove-cover="removeCover"
        />

        <main class="col-center a-card-sm">
          <template v-if="contentReady">
            <PostEditorTopbar
              :is-edit="isEdit"
              :draft-status="draftStatus"
              :content-source="contentSource"
              :saving="saving"
              @import-file="handleFileUpload"
              @go-back="goBack"
              @toggle-settings="toggleSettingsPanel"
              @toggle-outline="toggleOutlinePanel"
              @trigger-reimport="triggerReimport"
              @open-version-history="versionHistoryOpen = true"
              @save-draft="save('draft')"
              @save-published="save('published')"
            >
              <template #schedule>
                <ContentScheduleControl
                  v-model="scheduledAt"
                  :busy="scheduling"
                  :disabled="Boolean(saving) || uploading || coverUploading"
                  @schedule="schedulePublish"
                />
              </template>
            </PostEditorTopbar>

            <div class="editor-workspace">
              <section class="editor-canvas">
                <div v-if="isCollabEditing" class="collab-mode-banner">
                  <span class="collab-mode-banner__label">协作编辑</span>
                  <p class="collab-mode-banner__text">协作编辑请使用专业模式</p>
                </div>
                <div class="editor-body">
                  <PEditor
                    ref="editorRef"
                    v-model="editorBody"
                    :mode="editorMode"
                    :no-border="true"
                    :protect-first-line="true"
                    :enable-embeds="true"
                    :enable-mentions="true"
                    :enable-collab="shouldEnableCollab"
                    :collab-room-id="collabRoomId"
                    :show-mode-toggle="!shouldEnableCollab"
                    :show-sync-scroll-toggle="true"
                    :sync-scroll="syncScroll"
                    @active-heading-change="activeHeadingLine = $event"
                    @collab-ready="handleCollabReady"
                    @mode-change="editorMode = $event"
                    @update:sync-scroll="syncScroll = $event"
                  />
                </div>
              </section>
            </div>
          </template>

          <div v-else class="editor-loading">加载中…</div>
        </main>

        <PostEditorOutline
          :mobile-open="mobilePanel === 'outline'"
          :desktop-open="outlinePanelOpen"
          :outline-count="outline.length"
          :flattened-outline="flattenedOutline"
          :active-heading-line="activeHeadingLine"
          @jump-to-heading="jumpToHeading"
        />
      </div>
    </div>

    <div v-if="contentReady" class="editor-mobile-publish-actions">
      <PButton type="button" variant="secondary" :loading="saving === 'draft'" :disabled="Boolean(saving)" loading-text="保存中…" @click="save('draft')">存草稿</PButton>
      <PButton type="button" variant="primary" :loading="saving === 'published'" :disabled="Boolean(saving)" loading-text="发布中…" @click="save('published')">发布</PButton>
    </div>

    <PostEditorDraftRecoveryModal
      v-if="recoveryModalVisible && pendingDraftCandidate"
      :title="recoveryModalTitle"
      :label="recoveryModalLabel"
      :message="recoveryModalText"
      :draft-title="pendingDraftCandidate.payload.title"
      :preview="draftRecoveryPreview"
      :keep-label="keepCurrentContentLabel"
      :collab-conflict="isCollabConflict"
      @keep="keepCurrentContent"
      @discard="discardPendingDraft"
      @restore="restorePendingDraft"
    />

    <PModal v-if="draftManagerVisible" title="草稿管理" size="md" @close="closeDraftManager">
      <div class="draft-manager-body">
        <div class="draft-manager-grid">
          <div class="draft-manager-card a-card-sm">
            <span class="a-label">本地草稿</span>
            <strong>{{ localDraftStatusText }}</strong>
            <p class="a-muted">保存在当前浏览器中，刷新页面后仍可恢复。</p>
          </div>

          <div class="draft-manager-card a-card-sm">
            <span class="a-label">云端草稿</span>
            <strong>{{ cloudDraftStatusText }}</strong>
            <p class="a-muted">登录状态下自动同步，可在其他会话中继续写作。</p>
          </div>
        </div>

        <div v-if="deferredDraftCandidate" class="draft-manager-card draft-manager-card-accent a-card-sm">
          <span class="a-label">待恢复草稿</span>
          <strong>{{ deferredDraftCandidate.payload.title || '未命名草稿' }}</strong>
          <p class="a-muted">{{ deferredDraftCandidate.source === 'server' ? '云端' : '本地' }}版本，保存于 {{ formatSavedTime(deferredDraftCandidate.savedAt) }}</p>
          <p class="draft-manager-preview">{{ deferredDraftSummary }}</p>
        </div>

        <div v-if="serverDraftState === 'error'" class="draft-manager-warning">
          云端草稿同步失败，当前变更仍保存在本地。你可以稍后重试同步，或继续在当前会话中编辑。
        </div>
      </div>

      <template #footer>
        <div class="draft-recovery-actions">
          <PButton type="button" variant="secondary" @click="closeDraftManager">关闭</PButton>
          <PButton
            v-if="authStore.token && hasMeaningfulDraft(draftPayload)"
            type="button"
            variant="secondary"
            @click="syncDraftNow"
          >
            立即同步
          </PButton>
          <PButton
            v-if="hasDraftManagerAccess"
            type="button"
            variant="ghost"
            @click="clearSavedDrafts"
          >
            清除已保存草稿
          </PButton>
          <PButton
            v-if="deferredDraftCandidate"
            type="button"
            variant="primary"
            @click="restoreDeferredFromManager"
          >
            恢复最新草稿
          </PButton>
        </div>
      </template>
    </PModal>

    <PModal v-if="leaveConfirmVisible" title="草稿仍在同步" size="sm" @close="cancelLeave">
      <div class="leave-confirm-body">
        <p class="leave-confirm-text">{{ leaveConfirmText }}</p>
        <p class="a-muted">继续离开会中断当前这次保存或同步，最新改动可能无法写入草稿。</p>
      </div>

      <template #footer>
        <div class="draft-recovery-actions">
          <PButton type="button" variant="secondary" @click="cancelLeave">留在此页</PButton>
          <PButton type="button" variant="primary" @click="confirmLeave">继续离开</PButton>
        </div>
      </template>
    </PModal>

    <PostVersionHistoryModal
      v-if="versionHistoryOpen && isEdit"
      :post-id="String(route.params.id || '')"
      @close="versionHistoryOpen = false"
      @restored="handleVersionRestored"
    />
  </div>
</template>

<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PEditor from '@/components/shared/PEditor.vue'
import PostEditorOutline from '@/components/blog/PostEditorOutline.vue'
import PostEditorSidebar from '@/components/blog/PostEditorSidebar.vue'
import PostEditorTopbar from '@/components/blog/PostEditorTopbar.vue'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PostEditorDraftRecoveryModal from '@/components/blog/PostEditorDraftRecoveryModal.vue'
import PostVersionHistoryModal from '@/components/blog/PostVersionHistoryModal.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import ContentScheduleControl from '@/components/content/ContentScheduleControl.vue'
import { usePostEditorCollections } from '@/composables/blog/usePostEditorCollections'
import { usePostEditorPublication } from '@/composables/blog/usePostEditorPublication'
import {
  usePostEditorDraftSession,
  type BlogVisibility,
  type EditorDraftPayload,
  type PostEditorContentSource,
  type PostEditorDraftForm,
  type SaveTarget,
} from '@/composables/blog/usePostEditorDraftSession'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const api = useApi()
const studio = useStudioStore()

// ── 布局 ─────────────────────────────────────────────────
type OutlineItem = {
  id: string
  level: number
  text: string
  line: number
  parentId: string | null
}

type FlattenedOutlineNode = OutlineItem & {
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  isActiveBranch: boolean
}

const editorRef = ref<InstanceType<typeof PEditor> | null>(null)
const activeHeadingLine = ref<number | null>(null)
const mobilePanel = ref<'outline' | 'settings' | null>(null)
const settingsPanelOpen = ref(false)
const outlinePanelOpen = ref(false)
const editorMode = ref<'normal' | 'split'>('normal')
const syncScroll = ref(true)

const isCompactEditor = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches

const toggleSettingsPanel = () => {
  if (isCompactEditor()) {
    mobilePanel.value = mobilePanel.value === 'settings' ? null : 'settings'
    return
  }
  settingsPanelOpen.value = !settingsPanelOpen.value
}

const toggleOutlinePanel = () => {
  if (isCompactEditor()) {
    mobilePanel.value = mobilePanel.value === 'outline' ? null : 'outline'
    return
  }
  outlinePanelOpen.value = !outlinePanelOpen.value
}

const goBack = () => {
  router.back()
}

const saving = ref<SaveTarget | null>(null)
const preferredPublishStatus = ref<SaveTarget>('published')
const savedPostId = ref<string | null>(null)
const scheduling = ref(false)
const scheduledAt = ref('')
const versionHistoryOpen = ref(false)

// ── 状态 ─────────────────────────────────────────────────
const isEdit = computed(() => !!route.params.id)
const collabRoomId = computed(() => {
  if (!isEdit.value) return undefined
  const postId = String(route.params.id || '').trim()
  return postId || undefined
})
const shouldEnableCollab = computed(() => Boolean(collabRoomId.value))
const isCollabEditing = computed(() => shouldEnableCollab.value)
const contentReady = ref(!route.params.id)
const uploading = ref(false)
const coverUploading = ref(false)
const error = ref('')
const coverUploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const contentSource = ref<PostEditorContentSource>('empty')
const loadedPostUpdatedAt = ref(0)

const form = ref<PostEditorDraftForm>({
  title: '',
  content: '',
  summary: '',
  cover_url: '',
  visibility: 'public' as BlogVisibility,
})

// ── Title-in-editor binding ──────────────────────────────
const editorBody = computed({
  get: () => `# ${form.value.title}\n${form.value.content}`,
  set: (val: string) => {
    const nl = val.indexOf('\n')
    const firstLine = nl >= 0 ? val.slice(0, nl) : val
    form.value.title = firstLine.replace(/^#+\s*/, '').trim()
    form.value.content = nl >= 0 ? val.slice(nl + 1) : ''
  },
})

// ── 字数统计 ─────────────────────────────────────────────
const charCount = computed(() => {
  const text = form.value.content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*`>~_\[\]()]/g, '')
    .trim()
  return text.replace(/\s+/g, '').length
})

// ── 目录提取 ─────────────────────────────────────────────
const outline = computed((): OutlineItem[] => {
  const lines = form.value.content.split('\n')
  const items: OutlineItem[] = []
  const levelStack: { level: number; id: string }[] = []

  for (let idx = 0; idx < lines.length; idx++) {
    const m = lines[idx].match(/^(#{2,})\s+(.+)/)
    if (!m) continue

    const level = m[1].length
    const text = m[2].trim()
    const line = idx + 1
    const id = `heading-${line}`

    while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= level) {
      levelStack.pop()
    }
    const parentId = levelStack.length > 0 ? levelStack[levelStack.length - 1].id : null
    levelStack.push({ level, id })
    items.push({ id, level, text, line, parentId })
  }

  return items
})

const flattenedOutline = computed((): FlattenedOutlineNode[] => {
  const items = outline.value
  if (!items.length) return []

  const minLevel = Math.min(...items.map(item => item.level))

  const activeItem = activeHeadingLine.value !== null
    ? [...items].reverse().find(item => item.line <= activeHeadingLine.value!)
    : null

  const activeBranchIds = new Set<string>()
  if (activeItem) {
    activeBranchIds.add(activeItem.id)
    let parentId = activeItem.parentId
    while (parentId) {
      activeBranchIds.add(parentId)
      const parent = items.find(item => item.id === parentId)
      parentId = parent?.parentId ?? null
    }
  }

  return items
    .filter(item => !item.parentId || activeBranchIds.has(item.parentId))
    .map(item => {
      const idx = items.indexOf(item)
      const hasChildren = idx + 1 < items.length && items[idx + 1].level > item.level
      return {
        ...item,
        depth: item.level - minLevel,
        hasChildren,
        isExpanded: hasChildren && activeBranchIds.has(item.id),
        isActiveBranch: activeBranchIds.has(item.id),
      }
    })
})

const jumpToHeading = (line: number) => {
  editorRef.value?.scrollToHeadingLine?.(line)
}

const {
  channelCollections,
  selectedCollectionIds,
  existingCollectionIds,
  currentChannelId,
  defaultCollectionId,
  selectedNonDefaultCollectionId,
  primaryCollectionId,
  derivedChannelId,
  authHeaders,
  ensureDefaultSelection,
  loadChannelCollections,
  onCollectionSelect,
} = usePostEditorCollections({
  isEdit,
  form,
  preferredPublishStatus,
  error,
})

const draftContextKey = computed(() => isEdit.value ? `blog:post:${String(route.params.id || '')}` : 'blog:new')
const draftPayload = computed<EditorDraftPayload>(() => ({
  context_key: draftContextKey.value,
  source_post_id: isEdit.value ? String(route.params.id || '') : undefined,
  title: form.value.title,
  content: form.value.content,
  summary: form.value.summary,
  cover_url: form.value.cover_url,
  visibility: form.value.visibility,
  channel_id: currentChannelId.value || derivedChannelId.value || undefined,
  collection_ids: Array.from(new Set(selectedCollectionIds.value)),
}))

const {
  recoveryModalVisible,
  pendingDraftCandidate,
  deferredDraftCandidate,
  draftManagerVisible,
  leaveConfirmVisible,
  serverDraftState,
  draftStatus,
  draftRecoveryPreview,
  deferredDraftSummary,
  hasDraftManagerAccess,
  localDraftStatusText,
  cloudDraftStatusText,
  leaveConfirmText,
  isCollabConflict,
  recoveryModalTitle,
  recoveryModalLabel,
  recoveryModalText,
  keepCurrentContentLabel,
  hasMeaningfulDraft,
  formatSavedTime,
  keepCurrentContent,
  closeDraftManager,
  restorePendingDraft,
  discardPendingDraft,
  restoreDeferredFromManager,
  syncDraftNow,
  handleCollabReady,
  clearSavedDrafts,
  cancelLeave,
  confirmLeave,
  clearAllDrafts,
  allowNextRouteLeave,
  startDraftSession,
} = usePostEditorDraftSession({
  isEdit,
  draftContextKey,
  draftPayload,
  form,
  contentSource,
  channelCollections,
  selectedCollectionIds,
  loadedPostUpdatedAt,
  contentReady,
  saving,
  ensureDefaultSelection,
  getReplaceEditorDocument: () => {
    const replaceDocument = editorRef.value?.replaceDocument
    if (typeof replaceDocument !== 'function') {
      throw new Error('协作编辑器尚未就绪，暂时不能恢复草稿到共享文档')
    }
    return replaceDocument.bind(editorRef.value)
  },
})

const { loadPost, save, schedulePublish } = usePostEditorPublication({
  isEdit,
  form,
  contentSource,
  contentReady,
  loadedPostUpdatedAt,
  saving,
  savedPostId,
  scheduling,
  scheduledAt,
  error,
  currentChannelId,
  primaryCollectionId,
  selectedNonDefaultCollectionId,
  selectedCollectionIds,
  existingCollectionIds,
  clearAllDrafts,
  allowNextRouteLeave,
})

const handleVersionRestored = async () => {
  versionHistoryOpen.value = false
  savedPostId.value = null
  contentReady.value = false
  await loadPost()
}

const handleCoverUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return

  if (!authStore.token) {
    coverUploadError.value = '请先登录后再上传封面'
    return
  }

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
  const maxSize = 5 * 1024 * 1024

  if (!allowedTypes.has(file.type)) {
    coverUploadError.value = '只支持 JPEG、PNG、GIF、WebP 格式的图片'
    return
  }
  if (file.size > maxSize) {
    coverUploadError.value = '图片不能超过 5MB'
    return
  }

  coverUploading.value = true
  coverUploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('image', file)

    const res = await apiRequestResult(api.blog.uploadImage, {
      method: 'POST',
      headers: authHeaders.value,
      body: formData,
    })

    const data = await Promise.resolve(res.data).catch(() => null)
    if (!res.ok) {
      throw new Error(data?.error || '封面上传失败')
    }
    if (!data?.url) {
      throw new Error('服务器没有返回封面地址')
    }

    form.value.cover_url = data.url
    if (contentSource.value === 'empty') {
      contentSource.value = 'manual'
    }
  } catch (e) {
    coverUploadError.value = e instanceof Error ? e.message : '封面上传失败'
  } finally {
    coverUploading.value = false
  }
}

const removeCover = () => {
  form.value.cover_url = ''
  coverUploadError.value = ''
}

// ── 导入 Markdown ─────────────────────────────────────────
const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const text = await file.text()
    const lines = text.split('\n')
    let title = ''
    let content = text
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('# ')) { title = trimmed.slice(2).trim(); break }
    }
    if (title) {
      const idx = text.split('\n').findIndex(l => l.trim().startsWith('# '))
      if (idx !== -1) content = text.split('\n').slice(idx + 1).join('\n').trim()
    }
    form.value.title = title || file.name.replace(/\.(md|markdown|txt)$/i, '')
    form.value.content = content
    contentSource.value = 'imported'
  } catch (e) {
    error.value = '读取文件失败'
  } finally {
    uploading.value = false
    target.value = ''
  }
}

const clearContent = () => {
  form.value.content = ''
  form.value.title = ''
  contentSource.value = 'empty'
}

const triggerReimport = () => { fileInput.value?.click() }

// ── 标题自动扩展高度 ─────────────────────────────────────

// ── 内容变化检测 ─────────────────────────────────────────
watch(() => form.value.title, (nv, ov) => {
  if (!ov && nv && contentSource.value === 'empty') contentSource.value = 'manual'
})

watch(() => currentChannelId.value, loadChannelCollections)

// ── 初始化 ───────────────────────────────────────────────
onMounted(async () => {
  await studio.loadState()
  await loadPost()
  await loadChannelCollections()
  await startDraftSession()
})
</script>

<style scoped>
.editor-page {
  position: relative;
  height: calc(100vh - 64px);
  background: var(--a-color-bg);
  overflow: hidden;
}

.editor-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.editor-error {
  margin: 0.75rem;
  padding: 0.9rem 1rem;
}

.editor-layout {
  position: relative;
  display: grid;
  grid-template-columns: 0 minmax(0, 1fr) 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  transition: grid-template-columns 160ms ease;
}

.editor-layout.has-settings-panel {
  grid-template-columns: 17.5rem minmax(0, 1fr) 0;
}

.editor-layout.has-outline-panel {
  grid-template-columns: 0 minmax(0, 1fr) 15rem;
}

.editor-layout.has-settings-panel.has-outline-panel {
  grid-template-columns: 17.5rem minmax(0, 1fr) 15rem;
}

.editor-mobile-publish-actions {
  display: none;
}

.col-left,
.col-center {
  min-height: 0;
}

.col-center {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--a-color-bg);
}

/* 字数统计 chip */
.word-count-chip {
  font-size: 0.72rem;
  font-weight: 500;
  font-family: 'SFMono-Regular', 'Consolas', monospace;
  color: var(--a-color-muted);
  letter-spacing: 0;
}

.settings-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}

.summary-counter {
  font-size: 0.68rem;
  color: var(--a-color-muted);
  text-align: right;
}

.hidden-file-input {
  display: none;
}

.editor-loading {
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.editor-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.editor-canvas {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: var(--a-color-bg);
}

.collab-mode-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
  border-bottom: var(--a-border);
  background: var(--a-color-surface);
}

.collab-mode-banner__label {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.45rem;
  border: 2px solid #000;
  background: #000;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  flex-shrink: 0;
}

.collab-mode-banner__text {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.editor-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-body > * {
  flex: 1;
  min-height: 0;
}

.title-placeholder {
  padding: 1.5rem 1.5rem 0;
  font-size: 2.5rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.12;
  color: var(--a-color-muted-soft);
  pointer-events: none;
  user-select: none;
}

.draft-recovery-body {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.25rem;
}

.draft-recovery-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--a-color-fg);
}

.draft-recovery-preview {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem;
  background: var(--a-color-surface);
}

.draft-recovery-preview strong {
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0;
}

.draft-recovery-preview .a-muted {
  margin: 0;
}

.draft-recovery-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0 1.25rem 1.25rem;
  flex-wrap: wrap;
}

.draft-manager-body,
.leave-confirm-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
}

.draft-manager-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.draft-manager-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem;
}

.draft-manager-card strong {
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0;
}

.draft-manager-card .a-muted {
  margin: 0;
}

.draft-manager-card-accent {
  background: var(--a-color-surface);
}

.draft-manager-preview,
.leave-confirm-text {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.7;
  color: var(--a-color-fg);
}

.draft-manager-warning {
  padding: 0.95rem 1rem;
  border: 2px solid var(--a-color-danger);
  background: color-mix(in srgb, var(--a-color-danger) 8%, var(--a-color-bg));
  color: var(--a-color-danger);
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.6;
}

.leave-confirm-body .a-muted {
  margin: 0;
}

.toc-section {
  flex: 1;
}

.toc-list {
  overflow-y: auto;
}

.toc-item {
  --toc-depth: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  color: var(--a-color-muted);
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 2px solid transparent;
}

.toc-item:hover {
  border-left-color: var(--a-color-border);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}

.toc-rail {
  width: calc(var(--toc-depth) * 0.8rem + 1px);
  min-height: 1.2rem;
  border-left: 1px solid var(--a-color-border-soft);
  opacity: 0.9;
}

.toc-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cover-upload-card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.9rem;
}

.cover-preview-wrap {
  overflow: hidden;
  border: var(--a-border);
  background: var(--a-color-surface);
}

.cover-preview-image {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.cover-empty-state {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  border: var(--a-border);
  background: var(--a-color-surface);
}

.cover-empty-state strong {
  font-size: 0.92rem;
  font-weight: 500;
}

.cover-empty-state .a-muted,
.cover-upload-hint {
  margin: 0;
}

.cover-upload-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.cover-upload-error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 0.8rem;
  font-weight: 500;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option-check {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--a-color-fg);
}

.option-check {
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: var(--a-color-bg);
  cursor: pointer;
}

.option-check input {
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: var(--a-color-fg);
}

@media (max-width: 1200px) {
  .editor-layout.has-settings-panel {
    grid-template-columns: 17.5rem minmax(0, 1fr) 0;
  }

  .editor-layout.has-outline-panel {
    grid-template-columns: 0 minmax(0, 1fr) 15rem;
  }

  .editor-layout.has-settings-panel.has-outline-panel {
    grid-template-columns: 17.5rem minmax(0, 1fr) 15rem;
  }
}

@media (max-width: 960px) {
  .editor-page {
    height: calc(100dvh - 64px);
  }

  .editor-layout {
    display: block;
    overflow: visible;
  }

  .editor-mobile-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: var(--a-border);
  }

  .editor-mobile-publish-actions {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 4;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0.625rem 0.75rem calc(0.625rem + env(safe-area-inset-bottom));
    border-top: var(--a-border);
    background: var(--a-color-bg);
  }

  .editor-mobile-publish-actions :deep(.p-button) {
    min-height: 2.75rem;
  }
}

@media (max-width: 640px) {
  .editor-error {
    margin: 0.5rem;
  }

  .collab-mode-banner {
    align-items: flex-start;
    flex-direction: column;
  }

  .draft-manager-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .title-placeholder {
    font-size: 1.75rem;
  }
}
</style>
