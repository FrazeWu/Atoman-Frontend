# 专辑上传 v2 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端对接后端 `feat/album-import-v2` 新 API，支持压缩包（ZIP/RAR/7Z/TAR）、多选文件、整个文件夹三种上传模式，并适配新状态机（queued/transcoding/needs_attention 等）。

**Architecture:**
- API 层补充 10+ 个新函数和对应 TS 类型。
- `musicCreationTypes.ts` 扩展 `MusicCreationAlbumImportDraft`，加入 `inputMode`、`files`、`stage`、新状态值。
- `MusicCreationAlbumSeedStep.vue` 重写上传区，增加模式切换 tab（压缩包/多选文件/文件夹）、逐文件 multipart 上传、文件列表状态展示。
- `MusicCreationFlowDrawer.vue`、`MusicCreationAlbumDetailsStep.vue` 适配 `stage` 字段和新状态。

**Tech Stack:** Vue 3.5 + TypeScript 5.9 (strict) + Pinia + Tailwind CSS v4 + Vitest

---

## 文件映射

| 操作 | 文件 |
|---|---|
| Modify | `src/api/musicV1.ts` |
| Modify | `src/components/music/musicCreationTypes.ts` |
| Modify | `src/components/music/MusicCreationAlbumSeedStep.vue` |
| Modify | `src/components/music/MusicCreationFlowDrawer.vue` |
| Modify | `src/components/music/MusicCreationAlbumDetailsStep.vue` |

---

## Task 1: 扩展 musicV1.ts API 类型和函数

**Files:**
- Modify: `src/api/musicV1.ts`

### 背景

后端 `feat/album-import-v2` worktree (`/root/Atoman/Atoman-Backend/.worktrees/album-import-v2`) 已暴露以下新路由：

```
POST   /music/imports/albums/:sessionId/files                              — 登记文件清单，返回带 fileId 的 AlbumImportFileDTO[]
POST   /music/imports/albums/:sessionId/files/:fileId/parts/:partNumber    — 获取分片预签名 URL
POST   /music/imports/albums/:sessionId/files/:fileId/parts/:partNumber/complete — 标记分片完成
POST   /music/imports/albums/:sessionId/files/:fileId/complete             — 完成单文件上传
POST   /music/imports/albums/:sessionId/files/:fileId/retry                — 重试失败文件
POST   /music/imports/albums/:sessionId/files/:fileId/replace              — 替换文件
DELETE /music/imports/albums/:sessionId/files/:fileId                      — 删除文件
POST   /music/imports/albums/:sessionId/complete                           — 完成会话（触发解析/转码队列）
DELETE /music/imports/albums/:sessionId                                    — 取消会话
GET    /music/imports/albums/:sessionId                                    — 获取会话状态（现有路由，返回结构扩展）
```

旧路由保持兼容：
```
POST /music/imports/albums/:sessionId/upload      — 同步 ZIP 上传（保留）
POST /music/imports/albums/:sessionId/multipart   — 开始单文件 multipart（保留，用于 archive 模式）
```

后端返回的新类型（`import_types.go`）：

```go
// AlbumImportFileDTO
type AlbumImportFileDTO struct {
    FileID           string `json:"fileId"`
    RelativePath     string `json:"relativePath"`
    FileName         string `json:"fileName"`
    Role             string `json:"role"`
    DetectedFormat   string `json:"detectedFormat"`
    Size             int64  `json:"size"`
    UploadStatus     string `json:"uploadStatus"`
    ProcessingStatus string `json:"processingStatus"`
    DiscNumber       int    `json:"discNumber"`
    TrackNumber      int    `json:"trackNumber"`
    Title            string `json:"title"`
    ErrorMessage     string `json:"errorMessage"`
}

// AlbumImportDTO (扩展)
type AlbumImportDTO struct {
    ImportID   string                 `json:"importId"`
    Status     string                 `json:"status"`
    InputMode  string                 `json:"inputMode"`
    Stage      string                 `json:"stage"`
    Progress   AlbumImportProgressDTO `json:"progress"`
    Files      []AlbumImportFileDTO   `json:"files"`
    // ...原有字段不变
}

// AlbumImportProgressDTO
type AlbumImportProgressDTO struct {
    Current int64 `json:"current"`
    Total   int64 `json:"total"`
}
```

- [ ] **Step 1: 在 `musicV1.ts` 中添加新 TS 类型**

在现有 `MusicAlbumImport` 类型附近（约 L101）添加以下类型：

```typescript
// 文件上传状态
export type MusicAlbumImportFileUploadStatus = 'pending' | 'uploading' | 'completing' | 'uploaded' | 'failed'
// 文件处理状态
export type MusicAlbumImportFileProcessingStatus = 'pending' | 'failed'
// 会话阶段（后台处理）
export type MusicAlbumImportStage =
  | 'upload'
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'transcoding'
  | 'ready'
  | 'committing'
  | 'completed'
  | 'failed'
  | 'canceled'
// 输入模式
export type MusicAlbumImportInputMode = 'auto' | 'archive' | 'files' | 'folder'

export type MusicAlbumImportFile = {
  fileId: string
  relativePath: string
  fileName: string
  role: string
  detectedFormat: string
  size: number
  uploadStatus: MusicAlbumImportFileUploadStatus
  processingStatus: MusicAlbumImportFileProcessingStatus
  discNumber: number
  trackNumber: number
  title: string
  errorMessage: string
}

export type MusicAlbumImportProgress = {
  current: number
  total: number
}
```

扩展现有 `MusicAlbumImport` 类型，加入：
```typescript
export type MusicAlbumImport = {
  importId: string
  status: MusicAlbumImportStatus
  inputMode: MusicAlbumImportInputMode   // 新增
  stage: MusicAlbumImportStage           // 新增
  progress: MusicAlbumImportProgress     // 新增
  files: MusicAlbumImportFile[]          // 新增
  // ...原有字段
}
```

扩展现有 `MusicAlbumImportStatus` 类型：
```typescript
export type MusicAlbumImportStatus =
  | 'pending_upload'
  | 'uploading'
  | 'uploaded'
  | 'queued'        // 新增：进入处理队列
  | 'extracting'
  | 'analyzing'     // 新增
  | 'transcoding'   // 新增
  | 'ready'
  | 'needs_attention' // 新增：有文件失败，但可继续
  | 'committing'
  | 'failed'
  | 'canceled'      // 新增
  | 'committed'
```

添加文件注册输入类型：
```typescript
export type RegisterMusicAlbumImportFileInput = {
  relativePath: string
  fileName: string
  fileSize: number
  contentType: string
}

export type RegisterMusicAlbumImportFilesInput = {
  files: RegisterMusicAlbumImportFileInput[]
}

export type MusicAlbumImportFilePartUpload = {
  partNumber: number
  uploadUrl: string
}
```

- [ ] **Step 2: 在 `musicV1Endpoints` 中添加新端点**

在 `albumImportMultipartComplete` 行后添加：

```typescript
albumImportFiles: (importId: string) => `${apiV1Base()}/music/imports/albums/${importId}/files`,
albumImportFile: (importId: string, fileId: string) => `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}`,
albumImportFilePart: (importId: string, fileId: string, partNumber: number) =>
  `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/parts/${partNumber}`,
albumImportFilePartComplete: (importId: string, fileId: string, partNumber: number) =>
  `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/parts/${partNumber}/complete`,
albumImportFileComplete: (importId: string, fileId: string) =>
  `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/complete`,
albumImportFileRetry: (importId: string, fileId: string) =>
  `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/retry`,
albumImportFileReplace: (importId: string, fileId: string) =>
  `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/replace`,
albumImportSessionComplete: (importId: string) =>
  `${apiV1Base()}/music/imports/albums/${importId}/complete`,
albumImportSessionCancel: (importId: string) =>
  `${apiV1Base()}/music/imports/albums/${importId}`,
```

- [ ] **Step 3: 添加新 API 函数**

在现有 `uploadMusicAlbumArchiveMultipart` 函数之后添加：

```typescript
/** 登记文件清单，后端返回带 fileId 的文件列表 */
export async function registerMusicAlbumImportFiles(
  importId: string,
  input: RegisterMusicAlbumImportFilesInput,
): Promise<MusicAlbumImport> {
  return apiPostJson<MusicAlbumImport>(musicV1Endpoints.albumImportFiles(importId), input)
}

/** 为单个文件的某分片获取预签名上传 URL */
export async function createMusicAlbumImportFilePartUpload(
  importId: string,
  fileId: string,
  partNumber: number,
  partSize: number,
): Promise<MusicAlbumImportFilePartUpload> {
  return apiPostJson<MusicAlbumImportFilePartUpload>(
    musicV1Endpoints.albumImportFilePart(importId, fileId, partNumber),
    { partSize },
  )
}

/** 标记单文件分片完成 */
export async function completeMusicAlbumImportFilePart(
  importId: string,
  fileId: string,
  partNumber: number,
  etag: string,
  size: number,
): Promise<MusicAlbumImport> {
  return apiPostJson<MusicAlbumImport>(
    musicV1Endpoints.albumImportFilePartComplete(importId, fileId, partNumber),
    { etag, size },
  )
}

/** 声明单文件所有分片已完成 */
export async function completeMusicAlbumImportFile(
  importId: string,
  fileId: string,
): Promise<MusicAlbumImport> {
  return apiPostJson<MusicAlbumImport>(musicV1Endpoints.albumImportFileComplete(importId, fileId), {})
}

/** 重试失败文件 */
export async function retryMusicAlbumImportFile(
  importId: string,
  fileId: string,
): Promise<MusicAlbumImport> {
  return apiPostJson<MusicAlbumImport>(musicV1Endpoints.albumImportFileRetry(importId, fileId), {})
}

/** 完成会话，触发后台处理队列 */
export async function completeMusicAlbumImportSession(importId: string): Promise<MusicAlbumImport> {
  return apiPostJson<MusicAlbumImport>(musicV1Endpoints.albumImportSessionComplete(importId), {})
}

/** 取消会话 */
export async function cancelMusicAlbumImportSession(importId: string): Promise<void> {
  await apiDelete(musicV1Endpoints.albumImportSessionCancel(importId))
}
```

注意：`apiDelete` 需要检查 `musicV1.ts` 中是否已有同名辅助函数；若无，使用 `apiPostJson` 改用 `fetch` DELETE method 或仿照 `apiGet` 实现。

- [ ] **Step 4: 修复 `validateMusicAlbumArchiveFile`，扩展接受的格式**

当前代码（约 L818-820）：
```typescript
export function validateMusicAlbumArchiveFile(file: File): void {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new Error('请上传 .zip 压缩包')
  }
}
```

改为：
```typescript
const SUPPORTED_ARCHIVE_EXTENSIONS = [
  '.zip', '.rar', '.7z', '.tar',
  '.tar.gz', '.tgz', '.tar.bz2', '.tar.xz',
]

export function validateMusicAlbumArchiveFile(file: File): void {
  const lower = file.name.toLowerCase()
  const supported = SUPPORTED_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext))
  if (!supported) {
    throw new Error('请上传压缩包文件（支持 ZIP、RAR、7Z、TAR 等格式）')
  }
}

export const SUPPORTED_ARCHIVE_ACCEPT = '.zip,.rar,.7z,.tar,.tar.gz,.tgz,.tar.bz2,.tar.xz'

export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg',
  '.opus', '.aiff', '.aif', '.wma', '.ape', '.alac',
]

export const SUPPORTED_AUDIO_ACCEPT = SUPPORTED_AUDIO_EXTENSIONS.join(',')
```

- [ ] **Step 5: 运行 type-check 验证**

```bash
cd /root/Atoman/Atoman-Frontend/.worktrees/album-import-v2
bun run type-check
```

Expected: 0 type errors（本 task 的改动范围内）

- [ ] **Step 6: Commit**

```bash
cd /root/Atoman/Atoman-Frontend/.worktrees/album-import-v2
git add src/api/musicV1.ts
git commit -m "feat(music): extend album import v2 api types and functions"
```

---

## Task 2: 扩展 musicCreationTypes.ts 状态模型

**Files:**
- Modify: `src/components/music/musicCreationTypes.ts`

- [ ] **Step 1: 扩展 `MusicCreationAlbumImportDraft`**

当前接口（L56-69）：
```typescript
export interface MusicCreationAlbumImportDraft {
  importId: string | null
  archiveName: string
  status: 'pending_upload' | 'uploading' | 'uploaded' | 'extracting' | 'ready' | 'failed' | 'committed'
  uploadProgress: number
  uploadSpeed: number
  coverUrl: string
  coverKey: string
  derivedAlbumTitle: string
  derivedCover: string
  derivedTracks: Array<{ title: string; audioKey: string; origin: string }>
  lastSyncedAt: string
  errorMessage: string
}
```

替换为：
```typescript
import type { MusicAlbumImportFile, MusicAlbumImportInputMode, MusicAlbumImportStage, MusicAlbumImportStatus } from '@/api/musicV1'

export interface MusicCreationAlbumImportDraft {
  importId: string | null
  inputMode: MusicAlbumImportInputMode
  archiveName: string
  status: MusicAlbumImportStatus
  stage: MusicAlbumImportStage
  uploadProgress: number
  uploadSpeed: number
  // 多文件模式下的文件状态列表
  files: MusicAlbumImportFile[]
  // 总上传字节进度（多文件模式用）
  totalBytesLoaded: number
  totalBytesTotal: number
  coverUrl: string
  coverKey: string
  derivedAlbumTitle: string
  derivedCover: string
  derivedTracks: Array<{ title: string; audioKey: string; origin: string }>
  lastSyncedAt: string
  errorMessage: string
}
```

- [ ] **Step 2: 更新 `useMusicDrawers.ts` 或相关初始化函数中的默认值**

找到 `MusicCreationAlbumImportDraft` 的默认初始化位置（通常在 `useMusicDrawers.ts` 或 store），确保新增字段有默认值：

```typescript
const defaultAlbumImportDraft = (): MusicCreationAlbumImportDraft => ({
  importId: null,
  inputMode: 'auto',
  archiveName: '',
  status: 'pending_upload',
  stage: 'upload',
  uploadProgress: 0,
  uploadSpeed: 0,
  files: [],
  totalBytesLoaded: 0,
  totalBytesTotal: 0,
  coverUrl: '',
  coverKey: '',
  derivedAlbumTitle: '',
  derivedCover: '',
  derivedTracks: [],
  lastSyncedAt: '',
  errorMessage: '',
})
```

- [ ] **Step 3: 运行 type-check**

```bash
cd /root/Atoman/Atoman-Frontend/.worktrees/album-import-v2
bun run type-check
```

Expected: 0 errors（若有 `status` 赋值不匹配，逐一修正）

- [ ] **Step 4: Commit**

```bash
git add src/components/music/musicCreationTypes.ts
# 同时 add 任何因 type-check 修正的文件
git commit -m "feat(music): extend album import draft type with inputMode, stage and files"
```

---

## Task 3: 重写 MusicCreationAlbumSeedStep.vue 上传区

**Files:**
- Modify: `src/components/music/MusicCreationAlbumSeedStep.vue`

### 目标 UI

三个模式 tab，默认选中"压缩包"：

```
┌──────────────────────────────────────────────────┐
│ 上传方式:  [压缩包]  [多选文件]  [选择文件夹]         │
├──────────────────────────────────────────────────┤
│                                                   │
│  [压缩包模式] — 单文件拖拽区，支持 ZIP/RAR/7Z/TAR   │
│  [多选文件模式] — multiple input，接受音频/封面/CUE  │
│  [文件夹模式] — webkitdirectory input             │
│                                                   │
│  [文件列表，每行：文件名 | 格式 | 进度 | 状态]        │
└──────────────────────────────────────────────────┘
```

### 多文件/文件夹上传流程

```
选择文件
→ createMusicAlbumImport({ artistId, inputMode: 'files'|'folder' })
→ registerMusicAlbumImportFiles(importId, { files: [...] })
  后端返回各文件的 fileId
→ 并发（最多 3 个）对每个文件执行 multipart 上传：
    startAlbumImportMultipart(importId, { fileName, fileSize, contentType })  ← 仍用旧 endpoint？
    或用新 per-file endpoint:
    createMusicAlbumImportFilePartUpload(importId, fileId, partNumber, partSize)
    → PUT uploadUrl（直接到 R2）
    completeMusicAlbumImportFilePart(importId, fileId, partNumber, etag, size)
    → 所有分片完成后 completeMusicAlbumImportFile(importId, fileId)
→ 所有文件上传完毕后 completeMusicAlbumImportSession(importId)
→ 会话进入 queued 状态，轮询 getMusicAlbumImport 直到 ready/needs_attention/failed
```

- [ ] **Step 1: 在 script setup 中添加模式切换状态和辅助逻辑**

```typescript
// 新增 import
import {
  createMusicAlbumImport,
  registerMusicAlbumImportFiles,
  startMusicAlbumImportMultipart,
  createMusicAlbumImportMultipartPartUpload,
  completeMusicAlbumImportFilePart,
  completeMusicAlbumImportFile,
  completeMusicAlbumImportSession,
  getMusicAlbumImport,
  SUPPORTED_ARCHIVE_ACCEPT,
  SUPPORTED_AUDIO_ACCEPT,
  type MusicAlbumImportInputMode,
  type RegisterMusicAlbumImportFileInput,
} from '@/api/musicV1'

// 新增 ref
const selectedMode = ref<MusicAlbumImportInputMode>('archive')
const filesInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
const uploadingFiles = ref<Map<string, number>>(new Map()) // fileId -> progress%
let pollTimer: ReturnType<typeof setTimeout> | null = null

// 计算总进度（多文件模式）
const multiFileTotalProgress = computed(() => {
  if (!albumImportDraft.value) return 0
  const { totalBytesLoaded, totalBytesTotal } = albumImportDraft.value
  return totalBytesTotal > 0 ? Math.round((totalBytesLoaded / totalBytesTotal) * 100) : 0
})

// 判断是否处于后台处理阶段（已入队）
const isBackendProcessing = computed(() => {
  const status = albumImportDraft.value?.status
  return status === 'queued' || status === 'extracting' || status === 'analyzing' || status === 'transcoding'
})
```

- [ ] **Step 2: 实现多文件上传核心逻辑**

```typescript
const PART_SIZE = 10 * 1024 * 1024 // 10MB

async function uploadSingleFileMultipart(
  importId: string,
  file: File,
  fileId: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  const totalParts = Math.ceil(file.size / PART_SIZE)
  let loaded = 0

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const start = (partNumber - 1) * PART_SIZE
    const end = Math.min(start + PART_SIZE, file.size)
    const chunk = file.slice(start, end)
    const partSize = end - start

    const upload = await createMusicAlbumImportFilePartUpload(importId, fileId, partNumber, partSize)

    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      body: chunk,
      headers: { 'Content-Length': String(partSize) },
    })
    if (!response.ok) throw new Error(`分片 ${partNumber} 上传失败`)

    const etag = response.headers.get('ETag') ?? ''
    await completeMusicAlbumImportFilePart(importId, fileId, partNumber, etag, partSize)

    loaded += partSize
    onProgress(loaded, file.size)
  }

  await completeMusicAlbumImportFile(importId, fileId)
}

async function handleFilesUpload(fileList: FileList) {
  if (!creationFlow.value || !albumImportDraft.value) return
  const files = Array.from(fileList)
  if (files.length === 0) return

  uploading.value = true
  errorMessage.value = ''
  albumImportDraft.value.status = 'uploading'
  albumImportDraft.value.inputMode = selectedMode.value
  albumImportDraft.value.totalBytesLoaded = 0
  albumImportDraft.value.totalBytesTotal = files.reduce((sum, f) => sum + f.size, 0)

  try {
    const session = await createMusicAlbumImport({
      artistId: creationFlow.value.draft.artist.id,
      inputMode: selectedMode.value,
    })
    albumImportDraft.value.importId = session.importId
    setMusicCreationStep('albumDetails')

    const fileInputs: RegisterMusicAlbumImportFileInput[] = files.map((f) => ({
      relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      fileName: f.name,
      fileSize: f.size,
      contentType: f.type || 'application/octet-stream',
    }))

    const registered = await registerMusicAlbumImportFiles(session.importId, { files: fileInputs })
    albumImportDraft.value.files = registered.files ?? []

    // 并发上传，最多 3 个
    const fileMap = new Map(files.map((f) => [
      (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      f,
    ]))

    const uploadQueue = (registered.files ?? []).map((registeredFile) => async () => {
      const file = fileMap.get(registeredFile.relativePath) ?? fileMap.get(registeredFile.fileName)
      if (!file) return
      await uploadSingleFileMultipart(
        session.importId,
        file,
        registeredFile.fileId,
        (loaded, total) => {
          if (!albumImportDraft.value) return
          // 用已完成字节估算总体进度（简化实现）
          uploadingFiles.value.set(registeredFile.fileId, Math.round((loaded / total) * 100))
        },
      )
    })

    // 分批并发
    for (let i = 0; i < uploadQueue.length; i += 3) {
      await Promise.all(uploadQueue.slice(i, i + 3).map((fn) => fn()))
    }

    await completeMusicAlbumImportSession(session.importId)
    if (albumImportDraft.value) albumImportDraft.value.status = 'queued'
    startPolling(session.importId)
  } catch (error) {
    if (albumImportDraft.value) {
      albumImportDraft.value.status = 'failed'
      albumImportDraft.value.errorMessage = error instanceof Error ? error.message : '上传失败'
    }
    errorMessage.value = error instanceof Error ? error.message : '上传失败'
  } finally {
    uploading.value = false
  }
}
```

- [ ] **Step 3: 实现轮询（queued/extracting/transcoding 等后台阶段）**

```typescript
function startPolling(importId: string) {
  if (pollTimer) clearTimeout(pollTimer)
  const poll = async () => {
    try {
      const snapshot = await getMusicAlbumImport(importId)
      applyImportSnapshot(snapshot)
      const done = ['ready', 'needs_attention', 'failed', 'canceled', 'committed'].includes(snapshot.status)
      if (!done) pollTimer = setTimeout(poll, 3000)
    } catch {
      pollTimer = setTimeout(poll, 5000)
    }
  }
  pollTimer = setTimeout(poll, 2000)
}

onUnmounted(() => { if (pollTimer) clearTimeout(pollTimer) })
```

- [ ] **Step 4: 更新 `applyImportSnapshot` 以处理新字段**

在 `applyImportSnapshot(snapshot: MusicAlbumImport)` 函数中额外同步：
```typescript
creationFlow.value.draft.albumImport.inputMode = snapshot.inputMode ?? 'auto'
creationFlow.value.draft.albumImport.stage = snapshot.stage ?? 'upload'
creationFlow.value.draft.albumImport.files = snapshot.files ?? []
```

- [ ] **Step 5: 重写 template 上传区**

在 `<section class="album-card album-card--primary">` 的 `<div class="field-group">` 内，替换现有单一 input 区域为：

```html
<!-- 模式切换 Tab -->
<div class="upload-mode-tabs" role="tablist">
  <button
    v-for="mode in uploadModes"
    :key="mode.key"
    role="tab"
    class="upload-mode-tab"
    :class="{ 'is-active': selectedMode === mode.key }"
    :disabled="uploading"
    @click="selectedMode = mode.key"
  >{{ mode.label }}</button>
</div>

<!-- 压缩包模式 -->
<div v-if="selectedMode === 'archive'" class="upload-zone" @click="archiveInputRef?.click()">
  <input
    ref="archiveInputRef"
    data-testid="album-import-archive-input"
    type="file"
    :accept="SUPPORTED_ARCHIVE_ACCEPT"
    :disabled="uploading"
    style="display: none"
    @change="handleArchiveChange"
  />
  <div class="upload-zone__icon"><!-- svg upload icon --></div>
  <p class="upload-zone__title">
    {{ albumImportDraft?.archiveName || '点击上传压缩包' }}
  </p>
  <p class="upload-zone__hint">支持 ZIP、RAR、7Z、TAR 格式</p>
</div>

<!-- 多选文件模式 -->
<div v-else-if="selectedMode === 'files'" class="upload-zone" @click="filesInputRef?.click()">
  <input
    ref="filesInputRef"
    data-testid="album-import-files-input"
    type="file"
    :accept="SUPPORTED_AUDIO_ACCEPT + ',.cue,.jpg,.jpeg,.png,.webp'"
    multiple
    :disabled="uploading"
    style="display: none"
    @change="(e) => handleFilesUpload((e.target as HTMLInputElement).files!)"
  />
  <div class="upload-zone__icon"><!-- svg files icon --></div>
  <p class="upload-zone__title">点击选择音频文件</p>
  <p class="upload-zone__hint">支持 MP3、FLAC、WAV、M4A、APE、OPUS 等，可多选</p>
</div>

<!-- 文件夹模式 -->
<div v-else-if="selectedMode === 'folder'" class="upload-zone" @click="folderInputRef?.click()">
  <input
    ref="folderInputRef"
    data-testid="album-import-folder-input"
    type="file"
    webkitdirectory
    :disabled="uploading"
    style="display: none"
    @change="(e) => handleFilesUpload((e.target as HTMLInputElement).files!)"
  />
  <div class="upload-zone__icon"><!-- svg folder icon --></div>
  <p class="upload-zone__title">点击选择专辑文件夹</p>
  <p class="upload-zone__hint">选择包含音频和封面的整个文件夹</p>
</div>

<!-- 文件列表（多文件模式） -->
<ul v-if="albumImportDraft.files.length > 0" class="import-file-list">
  <li
    v-for="f in albumImportDraft.files"
    :key="f.fileId"
    class="import-file-item"
    :class="`import-file-item--${f.uploadStatus}`"
  >
    <span class="import-file-name">{{ f.fileName }}</span>
    <span class="import-file-format">{{ f.detectedFormat }}</span>
    <span class="import-file-progress">
      <template v-if="f.uploadStatus === 'uploading'">
        {{ uploadingFiles.get(f.fileId) ?? 0 }}%
      </template>
      <template v-else-if="f.uploadStatus === 'uploaded'">✓</template>
      <template v-else-if="f.uploadStatus === 'failed'">{{ f.errorMessage || '失败' }}</template>
    </span>
  </li>
</ul>

<!-- 后台处理阶段提示 -->
<div v-if="isBackendProcessing" class="stage-banner">
  <span class="stage-label">{{ stageLabelMap[albumImportDraft.stage] ?? '处理中' }}</span>
  <span class="stage-hint">处理完成后将自动跳转</span>
</div>
```

在 script 中补充：
```typescript
const uploadModes = [
  { key: 'archive' as MusicAlbumImportInputMode, label: '压缩包' },
  { key: 'files' as MusicAlbumImportInputMode, label: '多选文件' },
  { key: 'folder' as MusicAlbumImportInputMode, label: '选择文件夹' },
]

const stageLabelMap: Record<string, string> = {
  queued: '等待处理',
  extracting: '解压中',
  analyzing: '分析中',
  transcoding: '转码中',
  ready: '已就绪',
  needs_attention: '需要确认',
  failed: '处理失败',
}
```

- [ ] **Step 6: 添加必要 CSS**

在 `<style>` 中补充：

```css
.upload-mode-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 12px;
  background: var(--p-surface-muted, #f0f0f0);
  border-radius: 8px;
  padding: 2px;
}

.upload-mode-tab {
  flex: 1;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--p-text-secondary, #666);
  transition: background 0.15s, color 0.15s;
}

.upload-mode-tab.is-active {
  background: var(--p-surface, #fff);
  color: var(--p-text, #111);
  font-weight: 500;
}

.upload-mode-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-file-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.import-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--p-border-subtle, #eee);
}

.import-file-item--failed .import-file-name { color: var(--p-error, #c00); }
.import-file-item--uploaded .import-file-name { opacity: 0.6; }

.import-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.import-file-format { font-family: monospace; color: var(--p-text-secondary, #666); }
.import-file-progress { min-width: 32px; text-align: right; }

.stage-banner {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--p-surface-muted, #f5f5f5);
  border-radius: 6px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.stage-label { font-weight: 500; }
.stage-hint { color: var(--p-text-secondary, #666); }
```

- [ ] **Step 7: type-check**

```bash
cd /root/Atoman/Atoman-Frontend/.worktrees/album-import-v2
bun run type-check
```

Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/components/music/MusicCreationAlbumSeedStep.vue
git commit -m "feat(music): add multi-file and folder upload modes to album import"
```

---

## Task 4: 适配 MusicCreationFlowDrawer.vue 和 MusicCreationAlbumDetailsStep.vue

**Files:**
- Modify: `src/components/music/MusicCreationFlowDrawer.vue`
- Modify: `src/components/music/MusicCreationAlbumDetailsStep.vue`

- [ ] **Step 1: 适配 `shouldShowFinishButton` 逻辑**

当前代码（`MusicCreationFlowDrawer.vue` 约 L108-112）：
```typescript
const shouldShowFinishButton = computed(() => {
  const flow = creationFlow.value
  if (!flow) return false
  return flow.step === 'albumDetails' || (flow.step === 'albumImport' && flow.draft.albumImport.status === 'ready')
})
```

新加状态 `needs_attention` 也应能进入"完成"流程：
```typescript
const shouldShowFinishButton = computed(() => {
  const flow = creationFlow.value
  if (!flow) return false
  if (flow.step === 'albumDetails') return true
  if (flow.step === 'albumImport') {
    const status = flow.draft.albumImport.status
    return status === 'ready' || status === 'needs_attention'
  }
  return false
})
```

- [ ] **Step 2: 适配 `canGoForward` 逻辑**

同文件约 L139：
```typescript
if (flow.step === 'albumImport') return flow.draft.albumImport.status === 'ready'
return flow.draft.albumImport.status === 'ready'
```

改为：
```typescript
if (flow.step === 'albumImport') {
  const status = flow.draft.albumImport.status
  return status === 'ready' || status === 'needs_attention'
}
return flow.draft.albumImport.status === 'ready' || flow.draft.albumImport.status === 'needs_attention'
```

- [ ] **Step 3: 适配 `isReadyForImport` 计算属性（`MusicCreationAlbumDetailsStep.vue` 约 L136-141）**

找到：
```typescript
const isReadyForImport = computed(() => {
  return flow.draft.albumImport.status === 'ready'
})
```

改为：
```typescript
const isReadyForImport = computed(() => {
  const status = creationFlow.value?.draft.albumImport.status
  return status === 'ready' || status === 'needs_attention'
})
```

- [ ] **Step 4: type-check**

```bash
cd /root/Atoman/Atoman-Frontend/.worktrees/album-import-v2
bun run type-check
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/music/MusicCreationFlowDrawer.vue src/components/music/MusicCreationAlbumDetailsStep.vue
git commit -m "feat(music): adapt flow state machine for v2 import statuses"
```

---

## Task 5: 最终验证和清理

**Files:** All modified files

- [ ] **Step 1: 完整 type-check**

```bash
cd /root/Atoman/Atoman-Frontend/.worktrees/album-import-v2
bun run type-check
```

Expected: 0 errors

- [ ] **Step 2: 单元测试**

```bash
bun run test:unit -- --reporter=verbose 2>&1 | tail -30
```

Expected: 无新增失败

- [ ] **Step 3: 检查文案合规（用户规则）**

核查以下内容不出现：
- "COMING SOON"、"研发"、"内部"、"System" 等开发者词汇
- 报错信息暴露内部原因（只提示如何修正）
- placeholder 复述规则

- [ ] **Step 4: 最终 commit（若有未提交修复）**

```bash
git add -A
git commit -m "fix(music): type-check cleanup for album import v2 frontend"
```

- [ ] **Step 5: 确认 diff 范围**

```bash
git diff main..HEAD --stat
```

Expected: 仅音乐上传相关文件变动，无不相关文件混入

