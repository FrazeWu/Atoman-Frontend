<template>
  <div class="editor-page">
    <div class="editor-shell">
      <div v-if="error" class="editor-error a-error">{{ error }}</div>
      <section v-if="markdownImportDiagnostics.length" class="import-diagnostics" aria-label="导入提示">
        <p v-for="diagnostic in markdownImportDiagnostics" :key="`${diagnostic.code}-${diagnostic.line}`">
          {{ diagnostic.line ? `第 ${diagnostic.line} 行：` : '' }}{{ diagnostic.message }}
        </p>
      </section>

      <div
        class="editor-layout"
        :class="{ 'has-sidebar-panel': sidebarPanelOpen }"
      >
        <main class="col-center a-card-sm">
          <template v-if="contentReady">
            <PostEditorTopbar
              :is-edit="isEdit"
              :draft-status="draftStatus"
              :content-source="contentSource"
              :saving="saving"
              :exporting="exporting"
              :content-mode="contentMode"
              :preview-open="previewOpen"
              :sidebar-open="sidebarPanelOpen || mobilePanel === 'sidebar'"
              @import-file="handleFileUpload"
              @export-markdown="handleMarkdownExport"
              @go-back="goBack"
              @toggle-sidebar="toggleSidebarPanel"
              @toggle-preview="togglePreview"
              @update:content-mode="contentMode = $event"
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
              <section class="editor-canvas" :class="{ 'is-preview-open': previewOpen }">
                <PostEditorFormattingToolbar
                  :line-numbers="lineNumbersVisible"
                  @command="executeFormattingCommand"
                  @update:line-numbers="lineNumbersVisible = $event"
                />
                <div class="editor-body">
                  <PEditor
                    :key="collabRoomId || 'new'"
                    ref="editorRef"
                    v-model="editorBody"
                    :mode="previewOpen ? 'split' : 'normal'"
                    :live-preview="contentMode === 'visual'"
                    :no-border="true"
                    :enable-embeds="true"
                    :enable-mentions="true"
                    :enable-collab="shouldEnableCollab"
                    :collab-room-id="collabRoomId"
                    :show-mode-toggle="false"
                    :show-sync-scroll-toggle="false"
                    :show-toolbar="false"
                    :show-reference-trigger="false"
                    :line-numbers="lineNumbersVisible"
                    :show-whitespace="true"
                    @update:line-numbers="lineNumbersVisible = $event"
                    @active-heading-change="activeHeadingLine = $event"
                    @collab-ready="handleCollabReady"
                  />
                </div>
              </section>
            </div>
          </template>

          <div v-else class="editor-loading">加载中…</div>
        </main>

        <PostEditorSidebar
          :mobile-open="mobilePanel === 'sidebar'"
          :desktop-open="sidebarPanelOpen"
          :channel-collections="channelCollections"
          :selected-collection-id="selectedNonDefaultCollectionId"
          :summary="form.summary"
          :visibility="form.visibility"
          :cover-url="form.cover_url"
          :cover-uploading="coverUploading"
          :cover-upload-error="coverUploadError"
          :outline-count="outline.length"
          :flattened-outline="flattenedOutline"
          :active-heading-line="activeHeadingLine"
          @select-collection="onCollectionSelect"
          @update:summary="(value) => (form.summary = value)"
          @update:visibility="(value) => (form.visibility = value)"
          @cover-upload="handleCoverUpload"
          @remove-cover="removeCover"
          @jump-to-heading="jumpToHeading"
          @close="mobilePanel = null"
        />
      </div>
    </div>

    <div v-if="contentReady && mobilePanel !== 'sidebar'" class="editor-mobile-publish-actions">
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
import PostEditorFormattingToolbar from '@/components/blog/PostEditorFormattingToolbar.vue'
import type { PostEditorCommand } from '@/components/blog/postEditorCommands'
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
const lineNumbersVisible = ref(true)
const previewOpen = ref(false)
const mobilePanel = ref<'sidebar' | null>(null)
const sidebarPanelOpen = ref(false)
const contentMode = ref<'markdown' | 'visual'>('markdown')
const exporting = ref(false)
const markdownImportID = ref<string | null>(null)
const markdownImportDiagnostics = ref<Array<{ code: string; line: number; message: string }>>([])

const executeFormattingCommand = (command: PostEditorCommand) => {
  editorRef.value?.executeCommand(command)
}

const isCompactEditor = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches

const toggleSidebarPanel = () => {
  if (isCompactEditor()) {
    const opening = mobilePanel.value !== 'sidebar'
    mobilePanel.value = opening ? 'sidebar' : null
    if (opening) previewOpen.value = false
    return
  }
  sidebarPanelOpen.value = !sidebarPanelOpen.value
}

const togglePreview = () => {
  previewOpen.value = !previewOpen.value
  if (previewOpen.value && isCompactEditor()) mobilePanel.value = null
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
const contentReady = ref(!route.params.id)
const uploading = ref(false)
const coverUploading = ref(false)
const error = ref('')
const coverUploadError = ref('')
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
    if (!/^#(?:\s|$)/.test(firstLine)) {
      form.value.content = val
      return
    }
    form.value.title = firstLine.replace(/^#\s?/, '').trim()
    form.value.content = nl >= 0 ? val.slice(nl + 1) : ''
  },
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
    const line = idx + 2
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
  source_content_id: isEdit.value ? String(route.params.id || '') : undefined,
  title: form.value.title,
  content: form.value.content,
  summary: form.value.summary,
  cover_url: form.value.cover_url,
  visibility: form.value.visibility,
  channel_id: currentChannelId.value || derivedChannelId.value || undefined,
  collection_id: primaryCollectionId.value || undefined,
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
  markdownImportID,
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
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiRequestResult(api.blog.markdownImport, {
      method: 'POST',
      headers: authHeaders.value,
      body: formData,
    })
    const data = await Promise.resolve(res.data).catch(() => null)
    if (!res.ok || !data) {
      throw new Error(data?.error || '导入 Markdown 失败')
    }
    form.value.title = data.title || file.name.replace(/\.(md|markdown|txt)$/i, '')
    form.value.summary = data.summary || ''
    form.value.content = data.content || ''
    markdownImportID.value = data.import_id || null
    markdownImportDiagnostics.value = Array.isArray(data.diagnostics) ? data.diagnostics : []
    contentSource.value = 'imported'
  } catch (e) {
    error.value = '读取文件失败'
  } finally {
    uploading.value = false
    target.value = ''
  }
}

const handleMarkdownExport = async () => {
  const contentID = String(route.params.id || '')
  if (!contentID || exporting.value) return
  exporting.value = true
  try {
    const response = await fetch(api.blog.postExport(contentID), { headers: authHeaders.value })
    if (!response.ok) throw new Error('导出 Markdown 失败')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `blog-${contentID}.zip`
    link.click()
    URL.revokeObjectURL(url)
  } catch {
    error.value = '导出 Markdown 失败'
  } finally {
    exporting.value = false
  }
}

// ── 内容变化检测 ─────────────────────────────────────────
watch(() => form.value.title, (nv, ov) => {
  if (!ov && nv && contentSource.value === 'empty') contentSource.value = 'manual'
})

watch(() => currentChannelId.value, loadChannelCollections)

const resetEditorStateForRoute = () => {
  form.value = { title: '', content: '', summary: '', cover_url: '', visibility: 'public' }
  contentSource.value = 'empty'
  loadedPostUpdatedAt.value = 0
  scheduledAt.value = ''
  savedPostId.value = null
  markdownImportID.value = null
  markdownImportDiagnostics.value = []
  error.value = ''
  selectedCollectionIds.value = []
  existingCollectionIds.value = []
  channelCollections.value = []
  contentReady.value = !isEdit.value
}

const initializeEditor = async () => {
  resetEditorStateForRoute()
  await studio.loadState()
  await loadPost()
  if (!isEdit.value) contentReady.value = true
  await loadChannelCollections()
  await startDraftSession()
}

watch(() => route.params.id, () => { void initializeEditor() })
onMounted(() => { void initializeEditor() })
</script>

<style scoped>
.import-diagnostics {
  margin: 0 0 0.75rem;
  padding: 0.65rem 0.8rem;
  border: var(--a-border);
  border-left: 3px solid var(--a-color-warning, #b7791f);
  background: var(--a-color-surface, var(--a-color-bg));
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.import-diagnostics p {
  margin: 0;
}

.import-diagnostics p + p {
  margin-top: 0.3rem;
}

.editor-page {
  position: relative;
  height: calc(
    100dvh -
    var(--a-topbar-height, 3.5rem) -
    3.75rem -
    clamp(2rem, 6vw, 4rem)
  );
  min-height: 0;
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
  grid-template-columns: minmax(0, 1fr) 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  transition: grid-template-columns 160ms ease;
}

.editor-layout.has-sidebar-panel {
  grid-template-columns: minmax(0, 1fr) 17.5rem;
}

.editor-mobile-publish-actions {
  display: none;
}

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

.editor-body :deep(.cm-scroller) {
  font-family: var(--a-font-sans, ui-sans-serif, system-ui, sans-serif) !important;
  font-size: 1.0625rem;
  line-height: 1.45 !important;
}

.editor-body :deep(.p-editor[data-live-preview="false"] .cm-scroller) {
  line-height: 1.35 !important;
}

.editor-body :deep(.p-editor[data-live-preview="false"] .cm-line:first-child) {
  padding-bottom: 0 !important;
  font-size: 1em !important;
  font-weight: inherit !important;
  line-height: inherit !important;
}

.editor-body :deep(.p-editor[data-live-preview="false"] .cm-line span) {
  font-size: inherit !important;
  font-weight: inherit !important;
  line-height: inherit !important;
}

.editor-body :deep(.cm-line:first-child) {
  padding-bottom: 0.25rem;
}

.editor-body :deep(.cm-gutters),
.editor-body :deep(.cm-gutter.cm-lineNumberGutter) {
  min-width: 38px;
}

.editor-body :deep(.cm-lineNumbers .cm-gutterElement) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 38px !important;
  padding: 0 4px !important;
  line-height: 1;
}

.editor-body :deep(.cm-content) {
  padding-inline: 0.75rem !important;
}

.editor-body :deep(.cm-activeLine) {
  background-color: #fffdf0 !important;
  box-shadow: -0.75rem 0 #fffdf0, 0.75rem 0 #fffdf0;
}

.editor-body :deep(.cm-activeLineGutter) {
  background-color: #fffdf0 !important;
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

@media (max-width: 1200px) {
  .editor-layout.has-sidebar-panel {
    grid-template-columns: minmax(0, 1fr) 17.5rem;
  }
}

@media (max-width: 960px) {
  .editor-page {
    height: calc(
      100dvh -
      var(--a-topbar-height, 3.5rem) -
      3.75rem -
      clamp(2rem, 6vw, 4rem)
    );
  }

  .editor-layout {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    overflow: visible;
  }

  .col-center {
    flex: 1;
    min-height: 0;
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

  .editor-canvas.is-preview-open :deep(.post-format-toolbar) {
    display: none;
  }

  .editor-body :deep(.p-editor.mode-split .sv-source) {
    display: none;
  }

  .editor-body :deep(.p-editor.mode-split .sv-preview) {
    min-height: 0;
  }
}

@media (max-width: 640px) {
  .editor-error {
    margin: 0.5rem;
  }

  .draft-manager-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
