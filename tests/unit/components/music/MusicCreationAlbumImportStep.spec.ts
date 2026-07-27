import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import MusicCreationAlbumSeedStep from '@/components/music/MusicCreationAlbumSeedStep.vue'
import MusicCreationAlbumDetailsStep from '@/components/music/MusicCreationAlbumDetailsStep.vue'
import * as musicApi from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

function snapshot(overrides: Partial<musicApi.MusicAlbumImport> = {}): musicApi.MusicAlbumImport {
  return {
    importId: 'import-1',
    status: 'pending_upload',
    archiveName: '',
    uploadProgress: 0,
    uploadSpeed: 0,
    coverUrl: '',
    coverKey: '',
    derivedAlbumTitle: '',
    derivedCover: '',
    derivedTracks: [],
    lastSyncedAt: '',
    errorMessage: '',
    inputMode: 'files',
    stage: 'upload',
    progress: { current: 0, total: 0 },
    files: [],
    errors: [],
    ...overrides,
  }
}

function fileInput(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[data-testid="album-import-files-input"]')
}

function setFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
}

function mockUploadTransport() {
  vi.spyOn(musicApi, 'createMusicAlbumImportFilePartUpload').mockResolvedValue({ partNumber: 1, uploadUrl: 'https://upload.test/part-1' })
  vi.spyOn(musicApi, 'completeMusicAlbumImportFilePart').mockResolvedValue(snapshot())
  vi.spyOn(musicApi, 'completeMusicAlbumImportFile').mockResolvedValue(snapshot())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200, headers: { ETag: 'etag-1' } })))
}

describe('MusicCreationAlbumImportStep.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded', startStep: 'albumImport' })
    drawers.setMusicCreationStep('albumImport')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('通过统一文件入口以 archive 自动模式注册、逐文件上传并完成会话', async () => {
    const archive = new File(['zip'], 'graduation.zip', { type: 'application/zip' })
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue(snapshot({ inputMode: 'archive' }))
    vi.spyOn(musicApi, 'registerMusicAlbumImportFiles').mockResolvedValue(snapshot({
      inputMode: 'archive',
      files: [{ fileId: 'file-1', relativePath: 'graduation.zip', fileName: 'graduation.zip', role: 'archive', detectedFormat: 'zip', size: archive.size, uploadStatus: 'pending', processingStatus: 'pending', discNumber: 0, trackNumber: 0, title: '', errorMessage: '' }],
    }))
    mockUploadTransport()
    vi.spyOn(musicApi, 'completeMusicAlbumImportSession').mockResolvedValue(snapshot({ status: 'queued', inputMode: 'archive' }))

    const wrapper = mount(MusicCreationAlbumSeedStep)
    setFiles(fileInput(wrapper).element as HTMLInputElement, [archive])
    await fileInput(wrapper).trigger('change')
    await flushPromises()

    expect(musicApi.createMusicAlbumImport).toHaveBeenCalledWith({ artistId: 'artist-seeded', inputMode: 'archive' })
    expect(musicApi.registerMusicAlbumImportFiles).toHaveBeenCalledWith('import-1', { files: [{ relativePath: 'graduation.zip', fileName: 'graduation.zip', fileSize: archive.size, contentType: 'application/zip' }] })
    expect(musicApi.createMusicAlbumImportFilePartUpload).toHaveBeenCalledWith('import-1', 'file-1', 1, archive.size)
    expect(musicApi.completeMusicAlbumImportFilePart).toHaveBeenCalledWith('import-1', 'file-1', 1, 'etag-1', archive.size)
    expect(musicApi.completeMusicAlbumImportFile).toHaveBeenCalledWith('import-1', 'file-1')
    expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledWith('import-1')
    expect(useMusicDrawers().state.value.creationFlow?.step).toBe('albumDetails')
  })

  it('在 ZIP 上传期间预填专辑名和曲目', async () => {
    const zip = new JSZip()
    zip.file('01 - Dawn.flac', 'audio')
    zip.file('02 - Dusk.mp3', 'audio')
    const archive = new File([await zip.generateAsync({ type: 'uint8array' })], 'Day Cycle.zip', { type: 'application/zip' })

    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue(snapshot({ inputMode: 'archive' }))
    vi.spyOn(musicApi, 'registerMusicAlbumImportFiles').mockResolvedValue(snapshot({ files: [] }))
    mockUploadTransport()
    vi.spyOn(musicApi, 'completeMusicAlbumImportSession').mockResolvedValue(snapshot({ status: 'queued' }))

    const wrapper = mount(MusicCreationAlbumSeedStep)
    setFiles(fileInput(wrapper).element as HTMLInputElement, [archive])
    await fileInput(wrapper).trigger('change')
    await flushPromises()

    await vi.waitFor(() => {
      const draft = useMusicDrawers().state.value.creationFlow?.draft
      expect(draft?.albumDetails.title).toBe('Day Cycle')
      expect(draft?.tracks.map((track) => track.title)).toEqual(['Dawn', 'Dusk'])
    })
    expect(musicApi.createMusicAlbumImport).toHaveBeenCalledTimes(1)
  })

  it('多文件选择自动使用 files 模式并保留所有注册文件', async () => {
    const audio = new File(['audio'], '01-song.mp3', { type: 'audio/mpeg' })
    const cover = new File(['cover'], 'cover.jpg', { type: 'image/jpeg' })
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue(snapshot())
    vi.spyOn(musicApi, 'registerMusicAlbumImportFiles').mockResolvedValue(snapshot({ files: [] }))
    mockUploadTransport()
    vi.spyOn(musicApi, 'completeMusicAlbumImportSession').mockResolvedValue(snapshot({ status: 'queued' }))

    const wrapper = mount(MusicCreationAlbumSeedStep)
    setFiles(fileInput(wrapper).element as HTMLInputElement, [audio, cover])
    await fileInput(wrapper).trigger('change')

    expect(musicApi.createMusicAlbumImport).toHaveBeenCalledWith({ artistId: 'artist-seeded', inputMode: 'files' })
    expect(musicApi.registerMusicAlbumImportFiles).toHaveBeenCalledWith('import-1', { files: [
      { relativePath: '01-song.mp3', fileName: '01-song.mp3', fileSize: audio.size, contentType: 'audio/mpeg' },
      { relativePath: 'cover.jpg', fileName: 'cover.jpg', fileSize: cover.size, contentType: 'image/jpeg' },
    ] })
  })

  it('接受会话快照中的空数组而不崩溃', async () => {
    const file = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' })
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue(snapshot())
    vi.spyOn(musicApi, 'registerMusicAlbumImportFiles').mockResolvedValue(snapshot({ files: null, errors: null, derivedTracks: null } as unknown as Partial<musicApi.MusicAlbumImport>))
    mockUploadTransport()
    vi.spyOn(musicApi, 'completeMusicAlbumImportSession').mockResolvedValue(snapshot({ status: 'queued', files: null, errors: null, derivedTracks: null } as unknown as Partial<musicApi.MusicAlbumImport>))

    const wrapper = mount(MusicCreationAlbumSeedStep)
    setFiles(fileInput(wrapper).element as HTMLInputElement, [file])
    await fileInput(wrapper).trigger('change')
    await flushPromises()

    const draft = useMusicDrawers().state.value.creationFlow?.draft.albumImport
    expect(draft?.files).toEqual([])
    expect(draft?.derivedTracks).toEqual([])
  })

  it('轮询提取、分析和就绪三个阶段，并应用最终快照', async () => {
    vi.useFakeTimers()
    const archive = new File(['zip'], 'stages.zip', { type: 'application/zip' })
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue(snapshot({ inputMode: 'archive' }))
    vi.spyOn(musicApi, 'registerMusicAlbumImportFiles').mockResolvedValue(snapshot({ files: [] }))
    mockUploadTransport()
    vi.spyOn(musicApi, 'completeMusicAlbumImportSession').mockResolvedValue(snapshot({ status: 'queued', stage: 'queued' }))
    vi.spyOn(musicApi, 'getMusicAlbumImport')
      .mockResolvedValueOnce(snapshot({ status: 'extracting', stage: 'extracting' }))
      .mockResolvedValueOnce(snapshot({ status: 'analyzing', stage: 'analyzing' }))
      .mockResolvedValueOnce(snapshot({ status: 'ready', stage: 'ready', derivedAlbumTitle: 'Stages' }))

    const wrapper = mount(MusicCreationAlbumSeedStep)
    setFiles(fileInput(wrapper).element as HTMLInputElement, [archive])
    await fileInput(wrapper).trigger('change')
    await vi.advanceTimersByTimeAsync(8000)

    expect(musicApi.getMusicAlbumImport).toHaveBeenCalledTimes(3)
    expect(useMusicDrawers().state.value.creationFlow?.draft.albumImport.status).toBe('ready')
    expect(useMusicDrawers().state.value.creationFlow?.draft.albumDetails.title).toBe('Stages')
  })

  it('失败文件可重试并可用替换文件重新上传', async () => {
    const original = new File(['audio'], 'broken.mp3', { type: 'audio/mpeg' })
    const replacement = new File(['audio'], 'fixed.mp3', { type: 'audio/mpeg' })
    const fileRecord = { fileId: 'file-1', relativePath: 'broken.mp3', fileName: 'broken.mp3', role: 'audio', detectedFormat: 'mp3', size: original.size, uploadStatus: 'failed' as const, processingStatus: 'failed' as const, discNumber: 1, trackNumber: 1, title: '', errorMessage: '网络错误' }
    vi.spyOn(musicApi, 'retryMusicAlbumImportFile').mockResolvedValue(snapshot({ status: 'uploading', files: [fileRecord] }))
    vi.spyOn(musicApi, 'replaceMusicAlbumImportFile').mockResolvedValue(snapshot({ status: 'uploading', files: [{ ...fileRecord, fileName: 'fixed.mp3', relativePath: 'fixed.mp3' }] }))
    mockUploadTransport()
    vi.mocked(musicApi.completeMusicAlbumImportFile).mockResolvedValue({
      ...fileRecord,
      uploadStatus: 'uploaded',
      processingStatus: 'pending',
    })
    vi.spyOn(musicApi, 'getMusicAlbumImport').mockResolvedValue(snapshot({
      status: 'uploaded',
      files: [{ ...fileRecord, uploadStatus: 'uploaded', processingStatus: 'pending' }],
    }))
    vi.spyOn(musicApi, 'completeMusicAlbumImportSession').mockResolvedValue(snapshot({
      status: 'queued',
      stage: 'queued',
      files: [{ ...fileRecord, uploadStatus: 'uploaded', processingStatus: 'pending' }],
    }))

    const drawers = useMusicDrawers()
    drawers.setMusicCreationStep('albumDetails')
    if (!drawers.state.value.creationFlow) throw new Error('creation flow missing')
    Object.assign(drawers.state.value.creationFlow.draft.albumImport, { importId: 'import-1', status: 'failed', files: [fileRecord] })
    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const replacementInput = wrapper.findAll('input[type="file"]')[1]

    await wrapper.get('.import-file-action').trigger('click')
    await flushPromises()
    expect(musicApi.retryMusicAlbumImportFile).toHaveBeenCalledWith('import-1', 'file-1')
    expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledWith('import-1')
    expect(drawers.state.value.creationFlow.draft.albumImport.status).toBe('queued')

    Object.assign(drawers.state.value.creationFlow.draft.albumImport, { status: 'failed', files: [fileRecord] })
    await flushPromises()
    await wrapper.findAll('.import-file-action')[1].trigger('click')
    setFiles(replacementInput.element as HTMLInputElement, [replacement])
    await replacementInput.trigger('change')
    await flushPromises()
    expect(musicApi.replaceMusicAlbumImportFile).toHaveBeenCalledWith('import-1', 'file-1', {
      relativePath: 'fixed.mp3', fileName: 'fixed.mp3', fileSize: replacement.size, contentType: 'audio/mpeg',
    })
    expect(musicApi.completeMusicAlbumImportFile).toHaveBeenCalledWith('import-1', 'file-1')
    expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledTimes(2)
  })
})
