import { ref, computed } from 'vue'
import {
  createMusicAlbumImport,
  uploadMusicAlbumArchiveMultipart,
  validateMusicAlbumArchiveFile,
  SUPPORTED_ARCHIVE_ACCEPT,
  SUPPORTED_AUDIO_ACCEPT,
  createMusicAlbumImportFilePartUpload,
  completeMusicAlbumImportFilePart,
  completeMusicAlbumImportFile,
  registerMusicAlbumImportFiles,
  completeMusicAlbumImportSession,
  getMusicAlbumImport,
  retryMusicAlbumImportFile,
  deleteMusicAlbumImportFile,
  type MusicAlbumImport,
  type MusicAlbumImportInputMode,
} from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

// Global state for album import upload so it survives step transitions
const uploading = ref(false)
const errorMessage = ref('')
const fileProgress = ref<Map<string, number>>(new Map())
let pollTimer: ReturnType<typeof setTimeout> | null = null

const FILE_PART_SIZE = 10 * 1024 * 1024 // 10MB

export function useAlbumImportUpload() {
  const { state, setMusicCreationStep } = useMusicDrawers()

  const creationFlow = computed(() => state.value.creationFlow)
  const albumImportDraft = computed(() => creationFlow.value?.draft.albumImport ?? null)

  function applyImportSnapshot(snapshot: MusicAlbumImport) {
    if (!creationFlow.value) return
    const derivedTracks = snapshot.derivedTracks ?? []

    creationFlow.value.draft.albumImport.importId = snapshot.importId
    creationFlow.value.draft.albumImport.status = snapshot.status
    creationFlow.value.draft.albumImport.archiveName = snapshot.archiveName
    creationFlow.value.draft.albumImport.uploadProgress = snapshot.uploadProgress
    creationFlow.value.draft.albumImport.uploadSpeed = snapshot.uploadSpeed
    creationFlow.value.draft.albumImport.coverUrl = snapshot.coverUrl
    creationFlow.value.draft.albumImport.coverKey = snapshot.coverKey
    creationFlow.value.draft.albumImport.derivedAlbumTitle = snapshot.derivedAlbumTitle
    creationFlow.value.draft.albumImport.derivedCover = snapshot.derivedCover
    creationFlow.value.draft.albumImport.derivedTracks = derivedTracks
    creationFlow.value.draft.albumImport.lastSyncedAt = snapshot.lastSyncedAt
    creationFlow.value.draft.albumImport.errorMessage = snapshot.errorMessage
    if (!creationFlow.value.titleCustomized) {
      creationFlow.value.draft.albumDetails.title =
        snapshot.derivedAlbumTitle || creationFlow.value.draft.albumDetails.title
    }

    if (!creationFlow.value.tracksCustomized) {
      creationFlow.value.draft.tracks = derivedTracks.map((track, index) => ({
        id: `import-track-${index + 1}`,
        sequence: index + 1,
        title: track.title,
        audioKey: track.audioKey,
        origin: track.origin,
      }))
    }
  }

  function startPolling(importId: string) {
    if (pollTimer) clearTimeout(pollTimer)
    const poll = async () => {
      if (!albumImportDraft.value || albumImportDraft.value.importId !== importId) return
      try {
        const snapshot = await getMusicAlbumImport(importId)
        applyImportSnapshot(snapshot)
        const done = ['ready', 'needs_attention', 'failed', 'canceled', 'committed'].includes(
          snapshot.status,
        )
        if (!done) pollTimer = setTimeout(poll, 3000)
      } catch {
        pollTimer = setTimeout(poll, 5000)
      }
    }
    pollTimer = setTimeout(poll, 2000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  async function uploadSingleFileMultipart(importId: string, file: File, fileId: string): Promise<void> {
    const totalParts = Math.ceil(file.size / FILE_PART_SIZE)
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * FILE_PART_SIZE
      const end = Math.min(start + FILE_PART_SIZE, file.size)
      const chunk = file.slice(start, end)
      const partSize = end - start

      const upload = await createMusicAlbumImportFilePartUpload(importId, fileId, partNumber, partSize)

      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        body: chunk,
      })
      if (!response.ok) throw new Error(`分片 ${partNumber} 上传失败`)

      const etag = response.headers.get('ETag') ?? ''
      await completeMusicAlbumImportFilePart(importId, fileId, partNumber, etag, partSize)

      fileProgress.value = new Map(fileProgress.value).set(
        fileId,
        Math.round((end / file.size) * 100),
      )
      
      if (albumImportDraft.value) {
        albumImportDraft.value.totalBytesLoaded += partSize
      }
    }
    await completeMusicAlbumImportFile(importId, fileId)
    fileProgress.value = new Map(fileProgress.value).set(fileId, 100)
  }

  async function handleArchiveChange(event: Event) {
    if (!creationFlow.value || !albumImportDraft.value) return

    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    uploading.value = true
    errorMessage.value = ''

    try {
      validateMusicAlbumArchiveFile(file)

      const session = await createMusicAlbumImport({ artistId: creationFlow.value.draft.artist.id })
      albumImportDraft.value.importId = session.importId
      albumImportDraft.value.status = 'uploading'
      albumImportDraft.value.archiveName = file.name
      albumImportDraft.value.uploadProgress = 0
      albumImportDraft.value.uploadSpeed = 0

      const snapshot = await uploadMusicAlbumArchiveMultipart(session.importId, file, {
        onProgress(progress) {
          if (!albumImportDraft.value) return
          albumImportDraft.value.status = 'uploading'
          albumImportDraft.value.uploadProgress = progress.total > 0
            ? Math.round((progress.loaded / progress.total) * 100)
            : 0
          albumImportDraft.value.uploadSpeed = progress.bytesPerSecond
          setMusicCreationStep('albumDetails')
        },
      })

      albumImportDraft.value.status = 'extracting'
      albumImportDraft.value.inputMode = 'archive'
      applyImportSnapshot(snapshot)
      if (['queued', 'extracting', 'analyzing', 'transcoding'].includes(snapshot.status)) {
        startPolling(session.importId)
      }
    } catch (error) {
      if (albumImportDraft.value) {
        albumImportDraft.value.status = 'failed'
        albumImportDraft.value.errorMessage = error instanceof Error ? error.message : '压缩包上传失败'
      }
      errorMessage.value = error instanceof Error ? error.message : '压缩包上传失败'
    } finally {
      uploading.value = false
      input.value = ''
    }
  }

  async function handleFilesUpload(fileList: FileList) {
    if (!creationFlow.value || !albumImportDraft.value) return
    const files = Array.from(fileList)
    if (files.length === 0) return

    uploading.value = true
    errorMessage.value = ''
    fileProgress.value = new Map()

    const draft = albumImportDraft.value
    draft.status = 'uploading'
    const hasRelativePaths = files.some(
      (f) => !!(f as File & { webkitRelativePath?: string }).webkitRelativePath,
    )
    const autoMode: MusicAlbumImportInputMode = hasRelativePaths ? 'folder' : 'files'
    draft.inputMode = autoMode
    draft.totalBytesLoaded = 0
    draft.totalBytesTotal = files.reduce((sum, f) => sum + f.size, 0)

    try {
      const session = await createMusicAlbumImport({
        artistId: creationFlow.value.draft.artist.id,
        inputMode: autoMode,
      })
      draft.importId = session.importId
      setMusicCreationStep('albumDetails')

      const fileInputs = files.map((f) => ({
        relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        fileName: f.name,
        fileSize: f.size,
        contentType: f.type || 'application/octet-stream',
      }))

      const registered = await registerMusicAlbumImportFiles(session.importId, { files: fileInputs })
      draft.files = registered.files ?? []

      const fileMap = new Map<string, File>()
      for (const f of files) {
        const relPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
        fileMap.set(relPath, f)
        fileMap.set(f.name, f)
      }

      const uploadTasks = (registered.files ?? [])
        .filter((rf) => rf.role !== 'archive')
        .map((registeredFile) => async () => {
          const file =
            fileMap.get(registeredFile.relativePath) ?? fileMap.get(registeredFile.fileName)
          if (!file) return
          await uploadSingleFileMultipart(session.importId, file, registeredFile.fileId)
        })

      for (let i = 0; i < uploadTasks.length; i += 3) {
        await Promise.all(uploadTasks.slice(i, i + 3).map((fn) => fn()))
      }

      await completeMusicAlbumImportSession(session.importId)
      draft.status = 'queued'
      startPolling(session.importId)
    } catch (error) {
      draft.status = 'failed'
      draft.errorMessage = error instanceof Error ? error.message : '上传失败'
      errorMessage.value = draft.errorMessage
    } finally {
      uploading.value = false
    }
  }

  async function handleAutoFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const fileList = input.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    const isArchive =
      files.length === 1 &&
      SUPPORTED_ARCHIVE_ACCEPT.split(',').some((ext) =>
        files[0].name.toLowerCase().endsWith(ext.trim()),
      )

    if (isArchive) {
      await handleArchiveChange(event)
    } else {
      await handleFilesUpload(fileList)
    }

    input.value = ''
  }

  async function handleRetryFile(fileId: string) {
    const draft = albumImportDraft.value
    if (!draft?.importId) return
    try {
      const snapshot = await retryMusicAlbumImportFile(draft.importId, fileId)
      draft.files = snapshot.files ?? draft.files
      startPolling(draft.importId)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '重试失败'
    }
  }

  async function handleDeleteFile(fileId: string) {
    const draft = albumImportDraft.value
    if (!draft?.importId) return
    try {
      const snapshot = await deleteMusicAlbumImportFile(draft.importId, fileId)
      draft.files = snapshot.files ?? draft.files.filter((f) => f.fileId !== fileId)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '移除失败'
    }
  }

  function resetUploadState() {
    uploading.value = false
    errorMessage.value = ''
    fileProgress.value.clear()
    stopPolling()
  }

  return {
    uploading,
    errorMessage,
    fileProgress,
    handleAutoFileChange,
    handleFilesUpload,
    handleRetryFile,
    handleDeleteFile,
    applyImportSnapshot,
    startPolling,
    stopPolling,
    resetUploadState,
  }
}
