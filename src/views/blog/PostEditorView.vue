<template>
  <div class="editor-page">
    <div class="editor-shell">
      <div v-if="error" class="editor-error a-error">{{ error }}</div>

      <div class="editor-layout">
        <PostEditorSidebar
          :mobile-open="mobilePanel === 'outline'"
          :saving="saving"
          :has-draft-manager-access="hasDraftManagerAccess"
          :channel-collections="channelCollections"
          :selected-collection-ids="selectedCollectionIds"
          :default-collection-id="defaultCollectionId"
          :summary="form.summary"
          :visibility="form.visibility"
          :allow-comments="form.allow_comments"
          :cover-url="form.cover_url"
          :cover-uploading="coverUploading"
          :cover-upload-error="coverUploadError"
          :outline-count="outline.length"
          :flattened-outline="flattenedOutline"
          :active-heading-line="activeHeadingLine"
          @save-draft="save('draft')"
          @save-published="save('published')"
          @open-draft-manager="openDraftManager"
          @toggle-collection="onCollectionToggle"
          @update:summary="(value) => (form.summary = value)"
          @update:visibility="(value) => (form.visibility = value)"
          @update:allowComments="(value) => (form.allow_comments = value)"
          @cover-upload="handleCoverUpload"
          @remove-cover="removeCover"
          @jump-to-heading="jumpToHeading"
        />
        <!-- 主编辑区 -->
        <main class="col-center a-card-sm">
          <div class="editor-mobile-actions">
            <PButton type="button" variant="secondary" size="sm" @click="mobilePanel = mobilePanel === 'outline' ? null : 'outline'">目录</PButton>
            <PButton type="button" variant="secondary" size="sm" @click="mobilePanel = mobilePanel === 'settings' ? null : 'settings'">设置</PButton>
          </div>

          <div v-if="contentReady" class="editor-workspace">
            <PostEditorTopbar
              :is-edit="isEdit"
              :char-count="charCount"
              :draft-status="draftStatus"
              :content-source="contentSource"
              :uploading="uploading"
              @import-file="handleFileUpload"
              @trigger-reimport="triggerReimport"
            />

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

          <div v-else class="editor-loading">加载中…</div>
        </main>
      </div>
    </div>

    <PModal v-if="recoveryModalVisible && pendingDraftCandidate" :title="recoveryModalTitle" size="md" @close="keepCurrentContent">
      <div class="draft-recovery-body">
        <span class="a-label">{{ recoveryModalLabel }}</span>
        <p class="draft-recovery-text">
          {{ recoveryModalText }}
        </p>

        <div class="draft-recovery-preview a-card-sm">
          <strong>{{ pendingDraftCandidate.payload.title || '未命名草稿' }}</strong>
          <p class="a-muted">{{ draftRecoveryPreview }}</p>
        </div>
      </div>

      <template #footer>
        <div class="draft-recovery-actions">
          <PButton type="button" variant="secondary" @click="keepCurrentContent">{{ keepCurrentContentLabel }}</PButton>
          <PButton v-if="!isCollabConflict" type="button" variant="ghost" @click="discardPendingDraft">丢弃草稿</PButton>
          <PButton type="button" variant="primary" @click="restorePendingDraft">恢复草稿</PButton>
        </div>
      </template>
    </PModal>

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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import PEditor from '@/components/shared/PEditor.vue'
import PostEditorSidebar from '@/components/blog/PostEditorSidebar.vue'
import PostEditorTopbar from '@/components/blog/PostEditorTopbar.vue'
import { useAutoSave } from '@/composables/useAutoSave'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { BlogDraft, Collection } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const api = useApi()

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

type DraftSyncState = 'idle' | 'syncing' | 'synced' | 'error'
type SaveTarget = 'draft' | 'published'
type BlogVisibility = 'public' | 'followers' | 'private'
type EditorDraftPayload = {
  context_key: string
  source_post_id?: string
  title: string
  content: string
  summary: string
  cover_url: string
  visibility: BlogVisibility
  allow_comments: boolean
  channel_id?: string
  collection_ids: string[]
}
type DraftCandidate = {
  source: 'local' | 'server'
  payload: EditorDraftPayload
  savedAt: number
}
type EditorSessionState = 'awaiting-collab' | 'collab-conflict' | 'collab-active' | 'local-edit'

const editorRef = ref<InstanceType<typeof PEditor> | null>(null)
const activeHeadingLine = ref<number | null>(null)
const mobilePanel = ref<'outline' | 'settings' | null>(null)
const editorMode = ref<'normal' | 'split'>('normal')
const syncScroll = ref(true)

const saving = ref<'draft' | 'published' | null>(null)

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
const channelCollections = ref<Collection[]>([])
const selectedCollectionIds = ref<string[]>([])
const existingCollectionIds = ref<string[]>([])
const uploading = ref(false)
const coverUploading = ref(false)
const error = ref('')
const coverUploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const contentSource = ref<'empty' | 'imported' | 'manual'>('empty')
const loadedPostUpdatedAt = ref(0)
const recoveryModalVisible = ref(false)
const pendingDraftCandidate = ref<DraftCandidate | null>(null)
const deferredDraftCandidate = ref<DraftCandidate | null>(null)
const draftManagerVisible = ref(false)
const leaveConfirmVisible = ref(false)
const serverDraftState = ref<DraftSyncState>('idle')
const serverDraftSavedAt = ref<number | null>(null)
const draftWatchEnabled = ref(false)
const isApplyingDraft = ref(false)
const pendingLeavePath = ref<string | null>(null)
const allowRouteLeaveOnce = ref(false)
const editorSessionState = ref<EditorSessionState>(route.params.id ? 'awaiting-collab' : 'local-edit')
const collabStartupFallbackTriggered = ref(false)

const form = ref({
  title: '',
  content: '',
  summary: '',
  cover_url: '',
  visibility: 'public' as BlogVisibility,
  allow_comments: true,
})

let serverSyncTimer: ReturnType<typeof setTimeout> | null = null
let collabStartupTimer: ReturnType<typeof setTimeout> | null = null

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

// ── 合集 ─────────────────────────────────────────────────
const selectedChannelId = computed(() => {
  const raw = route.query.channel
  return typeof raw === 'string' && raw ? raw : ''
})

const currentChannelId = ref<string>('')

const defaultCollectionId = computed(() => channelCollections.value.find(c => c.is_default)?.id)

const derivedChannelId = computed(() => {
  const col = channelCollections.value.find(c => selectedCollectionIds.value.includes(c.id))
  return col?.channel_id || ''
})

const authHeaders = computed(() => {
  const headers: Record<string, string> = {}
  if (authStore.token) {
    headers.Authorization = `Bearer ${authStore.token}`
  }
  return headers
})
const editorRoutePath = computed(() => isEdit.value ? `/post/${String(route.params.id || '')}/edit` : '/post/new')
const draftContextKey = computed(() => isEdit.value ? `blog:post:${String(route.params.id || '')}` : 'blog:new')
const draftPayload = computed<EditorDraftPayload>(() => ({
  context_key: draftContextKey.value,
  source_post_id: isEdit.value ? String(route.params.id || '') : undefined,
  title: form.value.title,
  content: form.value.content,
  summary: form.value.summary,
  cover_url: form.value.cover_url,
  visibility: form.value.visibility,
  allow_comments: form.value.allow_comments,
  channel_id: derivedChannelId.value || currentChannelId.value || selectedChannelId.value || undefined,
  collection_ids: Array.from(new Set(selectedCollectionIds.value)),
}))

const {
  autoSaveState,
  lastSavedAt,
  triggerAutoSave,
  loadDraft,
  clearDraft: clearLocalDraft,
} = useAutoSave<EditorDraftPayload>({
  getDraftKey: () => `blog_editor_${draftContextKey.value}`,
  getPayload: () => draftPayload.value,
  shouldPersist: (payload) => hasMeaningfulDraft(payload),
})

type DraftStatus = { text: string; tone: 'ok' | 'warn' | 'muted' }

const draftStatus = computed<DraftStatus>(() => {
  if (saving.value === 'published') {
    return { tone: 'warn', text: '发布中…' }
  }
  if (saving.value === 'draft') {
    return { tone: 'warn', text: '草稿保存中…' }
  }
  if (serverDraftState.value === 'error') {
    return { tone: 'warn', text: '云端草稿同步失败，当前仅保存在本地' }
  }
  if (autoSaveState.value === 'saving' || serverDraftState.value === 'syncing') {
    return { tone: 'warn', text: '草稿同步中…' }
  }
  if (deferredDraftCandidate.value) {
    return { tone: 'warn', text: '检测到可恢复草稿' }
  }
  if (lastSavedAt.value || serverDraftSavedAt.value) {
    const labels = []
    if (lastSavedAt.value) labels.push(`本地 ${formatSavedTime(lastSavedAt.value)}`)
    if (serverDraftSavedAt.value) labels.push(`云端 ${formatSavedTime(serverDraftSavedAt.value)}`)
    return { tone: 'ok', text: `草稿已保存 · ${labels.join(' · ')}` }
  }
  return { tone: 'muted', text: '开始写作后会自动保存草稿' }
})

const draftRecoveryPreview = computed(() => {
  const candidate = pendingDraftCandidate.value
  if (!candidate) return ''

  const sourceText = candidate.payload.summary || candidate.payload.content
  const plainText = sourceText.replace(/[#*_>`~\-\[\]()]/g, ' ').replace(/\s+/g, ' ').trim()
  return plainText || '这份草稿还没有正文预览。'
})

const deferredDraftSummary = computed(() => {
  const candidate = deferredDraftCandidate.value
  if (!candidate) return ''

  const sourceText = candidate.payload.summary || candidate.payload.content
  const plainText = sourceText.replace(/[#*_>`~\-\[\]()]/g, ' ').replace(/\s+/g, ' ').trim()
  return plainText || '这份草稿还没有正文预览。'
})

const hasDraftManagerAccess = computed(() => (
  !!deferredDraftCandidate.value
  || !!lastSavedAt.value
  || !!serverDraftSavedAt.value
  || hasMeaningfulDraft(draftPayload.value)
  || serverDraftState.value === 'error'
))

const localDraftStatusText = computed(() => {
  if (lastSavedAt.value) {
    return `最近保存于 ${formatSavedTime(lastSavedAt.value)}`
  }
  if (autoSaveState.value === 'saving') {
    return '正在保存中…'
  }
  if (hasMeaningfulDraft(draftPayload.value)) {
    return '已有编辑内容，等待下一次自动保存'
  }
  return '暂无本地草稿'
})

const cloudDraftStatusText = computed(() => {
  if (!authStore.token) {
    return '未登录，未启用云端草稿'
  }
  if (serverDraftState.value === 'syncing') {
    return '正在同步到云端…'
  }
  if (serverDraftState.value === 'error') {
    return '同步失败，等待手动重试'
  }
  if (serverDraftSavedAt.value) {
    return `最近同步于 ${formatSavedTime(serverDraftSavedAt.value)}`
  }
  if (hasMeaningfulDraft(draftPayload.value)) {
    return '尚未生成云端草稿'
  }
  return '暂无云端草稿'
})

const leaveConfirmText = computed(() => {
  if (saving.value === 'published') {
    return '文章正在发布中，离开后可能无法确认本次发布结果。'
  }
  if (saving.value === 'draft') {
    return '文章正在保存草稿，离开后本次保存可能无法完成。'
  }
  if (serverDraftState.value === 'syncing') {
    return '云端草稿仍在同步中，离开后最新改动可能只保留在本地。'
  }
  return '本地草稿仍在写入中，离开后最新改动可能不会进入已保存草稿。'
})

const currentDraftSignature = computed(() => JSON.stringify(draftPayload.value))
const hasPendingPersistence = computed(() => (
  autoSaveState.value === 'saving' || serverDraftState.value === 'syncing' || !!saving.value
))
const isCollabConflict = computed(() => editorSessionState.value === 'collab-conflict')
const recoveryModalTitle = computed(() => isCollabConflict.value ? '协作文档与草稿冲突' : '发现未恢复草稿')
const recoveryModalLabel = computed(() => {
  if (isCollabConflict.value) {
    return pendingDraftCandidate.value?.source === 'server' ? '云端草稿待恢复' : '本地草稿待恢复'
  }
  return pendingDraftCandidate.value?.source === 'server' ? '云端草稿' : '本地草稿'
})
const recoveryModalText = computed(() => {
  if (!pendingDraftCandidate.value) return ''
  const sourceText = pendingDraftCandidate.value.source === 'server' ? '云端' : '本地'
  if (isCollabConflict.value) {
    return `协作文档与草稿内容不一致。检测到一份较新的${sourceText}草稿，保存于 ${formatSavedTime(pendingDraftCandidate.value.savedAt)}。请选择保留协作文档，或恢复草稿后覆盖共享文档。`
  }
  return `检测到一份较新的${sourceText}草稿，保存于 ${formatSavedTime(pendingDraftCandidate.value.savedAt)}。恢复后会覆盖当前编辑区内容。`
})
const keepCurrentContentLabel = computed(() => isCollabConflict.value ? '保留协作文档' : '稍后处理')

const ensureDefaultSelection = () => {
  const def = channelCollections.value.find(c => c.is_default)
  if (def && !selectedCollectionIds.value.includes(def.id)) {
    selectedCollectionIds.value = [def.id, ...selectedCollectionIds.value]
  }
}

const hasMeaningfulDraft = (payload: EditorDraftPayload) => {
  return Boolean(
    payload.title.trim()
    || payload.content.trim()
    || payload.summary.trim()
    || payload.cover_url.trim()
    || payload.channel_id
    || payload.collection_ids.length
  )
}

const draftPayloadToMarkdown = (payload: EditorDraftPayload) => `# ${payload.title}\n${payload.content}`

const parseEditorMarkdown = (markdown: string) => {
  const normalized = markdown || ''
  const nl = normalized.indexOf('\n')
  const firstLine = nl >= 0 ? normalized.slice(0, nl) : normalized
  const title = firstLine.replace(/^#+\s*/, '').trim()
  const content = nl >= 0 ? normalized.slice(nl + 1) : ''

  return { title, content }
}

const hasMeaningfulMarkdown = (markdown: string) => {
  const { title, content } = parseEditorMarkdown(markdown)
  return Boolean(title.trim() || content.trim())
}

const normalizeEditorText = (value: string) => value.replace(/\r\n/g, '\n').trim()

const isEquivalentEditorContent = (
  left: Pick<EditorDraftPayload, 'title' | 'content'>,
  right: Pick<EditorDraftPayload, 'title' | 'content'>,
) => {
  return normalizeEditorText(left.title) === normalizeEditorText(right.title)
    && normalizeEditorText(left.content) === normalizeEditorText(right.content)
}

const applyEditorMarkdown = async (markdown: string) => {
  const { title, content } = parseEditorMarkdown(markdown)
  form.value.title = title
  form.value.content = content
  contentSource.value = hasMeaningfulMarkdown(markdown) ? 'manual' : 'empty'
  await nextTick()
}

const parseTimestamp = (value?: string | null) => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const formatSavedTime = (value?: number | null) => {
  if (!value) return '--:--'
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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

    const res = await fetch(api.blog.uploadImage, {
      method: 'POST',
      headers: authHeaders.value,
      body: formData,
    })

    const data = await res.json().catch(() => null)
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

const clearServerSyncTimer = () => {
  if (serverSyncTimer) {
    clearTimeout(serverSyncTimer)
    serverSyncTimer = null
  }
}

const clearCollabStartupTimer = () => {
  if (collabStartupTimer) {
    clearTimeout(collabStartupTimer)
    collabStartupTimer = null
  }
}

const blogDraftToPayload = (draft: BlogDraft): EditorDraftPayload => ({
  context_key: draft.context_key,
  source_post_id: draft.source_post_id,
  title: draft.title || '',
  content: draft.content || '',
  summary: draft.summary || '',
  cover_url: draft.cover_url || '',
  visibility: draft.visibility || 'public',
  allow_comments: draft.allow_comments,
  channel_id: draft.channel_id,
  collection_ids: draft.collection_ids || [],
})

const updateEditorChannel = async (channelId?: string) => {
  if (channelId) {
    await router.replace({ path: editorRoutePath.value, query: { channel: channelId } })
    currentChannelId.value = channelId
    return
  }

  if (!isEdit.value && selectedChannelId.value) {
    await router.replace({ path: editorRoutePath.value })
  }
  currentChannelId.value = ''
}

const setPendingDraftCandidate = (candidate: DraftCandidate | null) => {
  pendingDraftCandidate.value = candidate
  deferredDraftCandidate.value = candidate
}

const requireEditorReplaceDocument = () => {
  const replaceDocument = editorRef.value?.replaceDocument
  if (typeof replaceDocument !== 'function') {
    throw new Error('协作编辑器尚未就绪，暂时不能恢复草稿到共享文档')
  }
  return replaceDocument.bind(editorRef.value)
}

const getLatestDraftCandidate = async () => {
  const localDraft = loadDraft()
  const serverDraft = await fetchServerDraft()
  const candidates: DraftCandidate[] = []

  if (localDraft && hasMeaningfulDraft(localDraft.payload)) {
    lastSavedAt.value = localDraft.saved_at
    candidates.push({
      source: 'local',
      payload: localDraft.payload,
      savedAt: localDraft.saved_at,
    })
  }
  if (serverDraft) {
    const payload = blogDraftToPayload(serverDraft)
    if (hasMeaningfulDraft(payload)) {
      const savedAt = parseTimestamp(serverDraft.updated_at)
      serverDraftSavedAt.value = savedAt || serverDraftSavedAt.value
      candidates.push({
        source: 'server',
        payload,
        savedAt,
      })
    }
  }

  candidates.sort((left, right) => right.savedAt - left.savedAt)
  return candidates[0] ?? null
}

const finalizeCollabStartup = () => {
  clearCollabStartupTimer()
  editorSessionState.value = 'collab-active'
  recoveryModalVisible.value = false
  pendingDraftCandidate.value = null
}

const fetchServerDraft = async () => {
  if (!authStore.token) return null

  try {
    const res = await fetch(`${api.blog.draft}?context_key=${encodeURIComponent(draftContextKey.value)}`, {
      headers: authHeaders.value,
    })
    if (!res.ok) return null

    const data = await res.json()
    return (data.data || null) as BlogDraft | null
  } catch (e) {
    console.error('Failed to fetch blog draft:', e)
    return null
  }
}

const deleteServerDraft = async () => {
  clearServerSyncTimer()
  serverDraftState.value = 'idle'
  serverDraftSavedAt.value = null

  if (!authStore.token) return

  try {
    await fetch(`${api.blog.draft}?context_key=${encodeURIComponent(draftContextKey.value)}`, {
      method: 'DELETE',
      headers: authHeaders.value,
    })
  } catch (e) {
    console.error('Failed to delete blog draft:', e)
  }
}

const syncServerDraft = async () => {
  if (!authStore.token || !draftWatchEnabled.value) return

  const payload = draftPayload.value
  if (!hasMeaningfulDraft(payload)) {
    await deleteServerDraft()
    return
  }

  serverDraftState.value = 'syncing'
  try {
    const res = await fetch(api.blog.draft, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders.value },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to sync draft')

    const data = await res.json()
    const draft = (data.data || null) as BlogDraft | null
    serverDraftSavedAt.value = draft ? parseTimestamp(draft.updated_at) : Date.now()
    serverDraftState.value = 'synced'
  } catch (e) {
    console.error('Failed to sync blog draft:', e)
    serverDraftState.value = 'error'
  }
}

const scheduleServerDraftSync = () => {
  clearServerSyncTimer()
  if (!authStore.token || !draftWatchEnabled.value || isApplyingDraft.value) return
  serverSyncTimer = setTimeout(() => {
    void syncServerDraft()
  }, 1800)
}

const clearAllDrafts = async () => {
  clearLocalDraft()
  await deleteServerDraft()
  pendingDraftCandidate.value = null
  deferredDraftCandidate.value = null
  recoveryModalVisible.value = false
}

const applyDraftPayload = async (payload: EditorDraftPayload) => {
  isApplyingDraft.value = true
  try {
    form.value = {
      title: payload.title,
      content: payload.content,
      summary: payload.summary,
      cover_url: payload.cover_url,
      visibility: payload.visibility,
      allow_comments: payload.allow_comments,
    }

    contentSource.value = hasMeaningfulDraft(payload) ? 'manual' : 'empty'

    const allowed = new Set(channelCollections.value.map(collection => collection.id))
    selectedCollectionIds.value = payload.collection_ids.filter(collectionId => allowed.has(collectionId))
    if (selectedCollectionIds.value.length === 0) {
      ensureDefaultSelection()
    }

    await nextTick()
  } finally {
    isApplyingDraft.value = false
  }
}

const evaluateDraftRecovery = async () => {
  const latestCandidate = await getLatestDraftCandidate()
  if (!latestCandidate) return
  if (isEdit.value && latestCandidate.savedAt <= loadedPostUpdatedAt.value) {
    return
  }

  setPendingDraftCandidate(latestCandidate)
  recoveryModalVisible.value = true
}

const fallbackCollabRecovery = async () => {
  if (!isEdit.value || collabStartupFallbackTriggered.value || editorSessionState.value !== 'awaiting-collab') return
  collabStartupFallbackTriggered.value = true
  clearCollabStartupTimer()
  await evaluateDraftRecovery()
  if (!recoveryModalVisible.value) {
    editorSessionState.value = 'local-edit'
  }
}

const keepCurrentContent = () => {
  recoveryModalVisible.value = false
  pendingDraftCandidate.value = null
  if (isCollabConflict.value) {
    finalizeCollabStartup()
  }
}

const openDraftManager = () => {
  draftManagerVisible.value = true
}

const closeDraftManager = () => {
  draftManagerVisible.value = false
}

const reopenDraftRecovery = () => {
  if (!deferredDraftCandidate.value) return
  pendingDraftCandidate.value = deferredDraftCandidate.value
  recoveryModalVisible.value = true
}

const restorePendingDraft = async () => {
  const candidate = pendingDraftCandidate.value
  if (!candidate) return

  if (isCollabConflict.value) {
    const markdown = draftPayloadToMarkdown(candidate.payload)
    const replaceDocument = requireEditorReplaceDocument()
    await applyDraftPayload(candidate.payload)
    replaceDocument(markdown)
    deferredDraftCandidate.value = null
    finalizeCollabStartup()
    return
  }

  recoveryModalVisible.value = false
  deferredDraftCandidate.value = null
  pendingDraftCandidate.value = null
  await applyDraftPayload(candidate.payload)
}

const discardPendingDraft = async () => {
  await clearAllDrafts()
}

const restoreDeferredFromManager = async () => {
  if (!deferredDraftCandidate.value) return
  pendingDraftCandidate.value = deferredDraftCandidate.value
  draftManagerVisible.value = false
  await restorePendingDraft()
}

const syncDraftNow = async () => {
  clearServerSyncTimer()
  await syncServerDraft()
}

const handleCollabReady = async (markdown: string) => {
  if (!isEdit.value) return

  clearCollabStartupTimer()
  editorSessionState.value = 'awaiting-collab'
  await applyEditorMarkdown(markdown)

  const latestCandidate = await getLatestDraftCandidate()
  if (!latestCandidate) {
    finalizeCollabStartup()
    return
  }

  const draftMarkdown = draftPayloadToMarkdown(latestCandidate.payload)
  const hasCollabContent = hasMeaningfulMarkdown(markdown)
  const hasDraftContent = hasMeaningfulDraft(latestCandidate.payload)

  if (
    hasCollabContent
    && hasDraftContent
    && !isEquivalentEditorContent(parseEditorMarkdown(markdown), latestCandidate.payload)
  ) {
    setPendingDraftCandidate(latestCandidate)
    editorSessionState.value = 'collab-conflict'
    recoveryModalVisible.value = true
    return
  }

  if (!hasCollabContent && hasDraftContent) {
    await applyDraftPayload(latestCandidate.payload)
    requireEditorReplaceDocument()(draftMarkdown)
  }

  deferredDraftCandidate.value = null
  finalizeCollabStartup()
}

const clearSavedDrafts = async () => {
  await clearAllDrafts()
  draftManagerVisible.value = false
}

const cancelLeave = () => {
  leaveConfirmVisible.value = false
  pendingLeavePath.value = null
}

const confirmLeave = async () => {
  const targetPath = pendingLeavePath.value
  leaveConfirmVisible.value = false
  pendingLeavePath.value = null
  if (!targetPath) return

  allowRouteLeaveOnce.value = true
  await router.push(targetPath)
}

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!hasPendingPersistence.value) return
  event.preventDefault()
  event.returnValue = ''
}

const loadChannels = async () => {
  if (!authStore.isAuthenticated) return
  try {
    const res = await fetch(`${api.blog.channels}?user_id=${authStore.user?.uuid}`, {
      headers: authHeaders.value,
    })
    if (res.ok) {
      const data = await res.json()
      if (selectedChannelId.value) {
        currentChannelId.value = selectedChannelId.value
      } else if (!isEdit.value) {
        const fallbackChannelId = data.data?.[0]?.id || ''
        if (fallbackChannelId) {
          await updateEditorChannel(fallbackChannelId)
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const loadChannelCollections = async () => {
  if (!authStore.isAuthenticated) {
    channelCollections.value = []
    selectedCollectionIds.value = []
    existingCollectionIds.value = []
    return
  }

  const channelId = selectedChannelId.value || currentChannelId.value
  if (!channelId) {
    channelCollections.value = []
    selectedCollectionIds.value = []
    return
  }

  try {
    const res = await fetch(api.blog.channelCollections(channelId), {
      headers: authHeaders.value,
    })
    if (!res.ok) { error.value = '加载合集失败'; return }
    const data = await res.json()
    channelCollections.value = data.data || []
    if (!isEdit.value) {
      const def = channelCollections.value.find(c => c.is_default) || channelCollections.value[0]
      selectedCollectionIds.value = def ? [def.id] : []
    }
    if (isEdit.value) {
      const allowed = channelCollections.value.map(c => c.id)
      selectedCollectionIds.value = existingCollectionIds.value.filter(id => allowed.includes(id))
      ensureDefaultSelection()
    }
  } catch (e) {
    console.error(e)
    error.value = '加载合集失败'
  }
}

const onCollectionToggle = (id: string, event: Event) => {
  const checked = !!(event.target as HTMLInputElement)?.checked
  if (checked) {
    if (!selectedCollectionIds.value.includes(id))
      selectedCollectionIds.value = [...selectedCollectionIds.value, id]
  } else {
    selectedCollectionIds.value = selectedCollectionIds.value.filter(x => x !== id)
    ensureDefaultSelection()
  }
}

// ── 同步合集 ─────────────────────────────────────────────
const syncPostCollections = async (postId: string) => {
  const target = Array.from(new Set(selectedCollectionIds.value))
  const existing = Array.from(new Set(existingCollectionIds.value))
  const toAdd = target.filter(id => !existing.includes(id))
  const toRemove = existing.filter(id => !target.includes(id))
  for (const id of toAdd) {
    const res = await fetch(api.blog.postCollections(postId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders.value },
      body: JSON.stringify({ collection_id: id }),
    })
    if (!res.ok) throw new Error('添加文章合集失败')
  }
  for (const id of toRemove) {
    const res = await fetch(api.blog.postCollection(postId, id), {
      method: 'DELETE', headers: authHeaders.value,
    })
    if (!res.ok) throw new Error('移除文章合集失败')
  }
  existingCollectionIds.value = [...target]
}

// ── 加载文章 ─────────────────────────────────────────────
const loadPost = async () => {
  if (!isEdit.value) return
  try {
    const postId = String(route.params.id || '')
    if (!postId) return
    const res = await fetch(api.blog.post(postId), {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (res.ok) {
      const d = await res.json()
      const p = d.data || d
      form.value = {
        title: p.title,
        content: p.content || '',
        summary: p.summary || '',
        cover_url: p.cover_url || '',
        visibility: p.visibility || 'public',
        allow_comments: p.allow_comments,
      }
      loadedPostUpdatedAt.value = parseTimestamp(p.updated_at)
      contentSource.value = 'manual'
      if (!selectedChannelId.value) {
        const fallback = p.channel_id || p.collections?.[0]?.channel_id
        if (fallback) {
          await router.replace({ path: `/posts/post/${postId}/edit`, query: { channel: fallback } })
        }
      }
      existingCollectionIds.value = (p.collections || []).map((c: Collection) => c.id)
      selectedCollectionIds.value = [...existingCollectionIds.value]
    }
  } catch (e) {
    console.error(e)
  } finally {
    contentReady.value = true
    await nextTick()
  }
}

// ── 保存 ─────────────────────────────────────────────────
const save = async (status: SaveTarget) => {
  if (!form.value.title.trim()) { error.value = '请输入文章标题'; return }
  if (!form.value.content.trim()) { error.value = '请输入文章内容'; return }
  error.value = ''
  saving.value = status
  const payload = { ...form.value, status }
  try {
    let res: Response
    if (isEdit.value) {
      const postId = String(route.params.id || '')
      res = await fetch(api.blog.post(postId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({
          ...payload,
          channel_id: derivedChannelId.value || currentChannelId.value || selectedChannelId.value || null,
          collection_ids: Array.from(new Set(selectedCollectionIds.value)),
        }),
      })
    } else {
      res = await fetch(api.blog.posts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify({
          ...payload,
          channel_id: derivedChannelId.value || selectedChannelId.value || undefined,
          collection_ids: Array.from(new Set(selectedCollectionIds.value)),
        }),
      })
    }
    if (res.ok) {
      const d = await res.json()
      const savedPost = d.data || d
      await clearAllDrafts()
      if (isEdit.value) await syncPostCollections(String(savedPost.id))
      router.push(`/post/${savedPost.id}`)
    } else {
      const err = await res.json()
      error.value = err.error || '保存失败，请重试'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '网络错误，请重试'
  } finally {
    saving.value = null
  }
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

watch(currentDraftSignature, () => {
  if (!draftWatchEnabled.value || isApplyingDraft.value || !contentReady.value) return
  if (contentSource.value === 'empty' && hasMeaningfulDraft(draftPayload.value)) {
    contentSource.value = 'manual'
  }
  triggerAutoSave()
  scheduleServerDraftSync()
})

watch(() => selectedChannelId.value, loadChannelCollections)

onBeforeRouteLeave((to) => {
  if (allowRouteLeaveOnce.value) {
    allowRouteLeaveOnce.value = false
    return true
  }
  if (!hasPendingPersistence.value) return true
  pendingLeavePath.value = to.fullPath
  leaveConfirmVisible.value = true
  return false
})

// ── 初始化 ───────────────────────────────────────────────
onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  await loadChannels()
  await loadPost()
  await loadChannelCollections()
  draftWatchEnabled.value = true
  if (isEdit.value) {
    editorSessionState.value = 'awaiting-collab'
    collabStartupFallbackTriggered.value = false
    clearCollabStartupTimer()
    collabStartupTimer = setTimeout(() => {
      void fallbackCollabRecovery()
    }, 1500)
  } else {
    await evaluateDraftRecovery()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  clearServerSyncTimer()
  clearCollabStartupTimer()
})
</script>

<style scoped>
.editor-page {
  height: calc(100vh - 64px);
  background: var(--a-color-surface);
  overflow: hidden;
}

.editor-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  height: 100%;
  box-sizing: border-box;
}

.import-actions,
.meta-chip-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.editor-error {
  padding: 0.9rem 1rem;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.editor-mobile-actions {
  display: none;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: var(--a-border);
}

.col-left,
.col-center {
  background: var(--a-color-bg);
  min-height: 0;
}

.col-left {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
}

.col-center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* 字数统计 chip */
.word-count-chip {
  font-size: 0.72rem;
  font-weight: 700;
  font-family: 'SFMono-Regular', 'Consolas', monospace;
  color: var(--a-color-muted);
  letter-spacing: 0.01em;
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
  font-weight: 700;
}

.editor-workspace {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  padding: 1.25rem;
}

.editor-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.editor-meta-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.draft-status {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.6rem;
  border: var(--a-border);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  background: var(--a-color-bg);
}

.draft-status.is-ok {
  border-color: var(--a-color-success);
  color: var(--a-color-success);
  background: color-mix(in srgb, var(--a-color-success) 8%, var(--a-color-bg));
}

.draft-status.is-warn {
  border-color: var(--a-color-danger);
  color: var(--a-color-danger);
  background: color-mix(in srgb, var(--a-color-danger) 8%, var(--a-color-bg));
}

.draft-status.is-muted {
  border-color: var(--a-color-disabled-border);
  color: var(--a-color-muted);
  background: var(--a-color-surface);
}


.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.65rem;
  border: var(--a-border);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--a-color-bg);
}

.hidden-file-input {
  display: none;
}

.editor-canvas {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
  border: var(--a-border);
  background: var(--a-color-bg);
}

.collab-mode-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
  border-bottom: var(--a-border);
  background: repeating-linear-gradient(
    -45deg,
    #fff,
    #fff 10px,
    #f3f3f3 10px,
    #f3f3f3 20px
  );
}

.collab-mode-banner__label {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.45rem;
  border: 2px solid #000;
  background: #000;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.collab-mode-banner__text {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 800;
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
  font-size: clamp(1.75rem, 2.5vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.04em;
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
  font-weight: 900;
  letter-spacing: -0.02em;
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
  font-weight: 900;
  letter-spacing: -0.02em;
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
  font-weight: 700;
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
  font-weight: 700;
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
  background-image: repeating-linear-gradient(
    to right,
    color-mix(in srgb, var(--a-color-border) 52%, transparent) 0 1px,
    transparent 1px 0.8rem
  );
  background-repeat: no-repeat;
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
  font-weight: 900;
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
  font-weight: 700;
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
  font-weight: 700;
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
  .editor-layout {
    grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .editor-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-mobile-actions {
    display: flex;
  }
}

@media (max-width: 800px) {
  .editor-shell {
    padding: 0.75rem;
  }
}

@media (max-width: 640px) {
  .editor-workspace {
    padding: 1rem;
  }

  .collab-mode-banner {
    align-items: flex-start;
    flex-direction: column;
  }

  .editor-meta-actions,
  .draft-recovery-actions {
    width: 100%;
  }

  .draft-status,
  .editor-meta-actions :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .draft-manager-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
