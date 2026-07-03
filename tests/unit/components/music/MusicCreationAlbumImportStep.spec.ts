import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationAlbumSeedStep from '@/components/music/MusicCreationAlbumSeedStep.vue'
import MusicCreationAlbumDetailsStep from '@/components/music/MusicCreationAlbumDetailsStep.vue'
import * as musicApi from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('MusicCreationAlbumImportStep.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded', startStep: 'albumImport' })
    drawers.setMusicCreationStep('albumImport')
  })

  it('shows upload progress and speed after a zip upload starts', async () => {
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue({
      importId: 'import-1',
      status: 'pending_upload',
      archiveName: '',
      uploadProgress: 0,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })
    vi.spyOn(musicApi, 'uploadMusicAlbumArchiveMultipart').mockImplementation(async (_importId, _file, options) => {
      options?.onProgress?.({ loaded: 512_000, total: 1_024_000, bytesPerSecond: 256_000 })
      await new Promise<never>(() => {})
    })

    const wrapper = mount(MusicCreationAlbumSeedStep)
    const file = new File(['zip'], 'late-registration.zip', { type: 'application/zip' })
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')

    expect(wrapper.text()).toContain('上传进度 50%')
    expect(wrapper.text()).toContain('250 KB/s')
  })

  it('有封面地址时显示图片预览而不是裸链接文本', async () => {
    const drawers = useMusicDrawers()
    if (!drawers.state.value.creationFlow) {
      throw new Error('creation flow not initialized')
    }

    drawers.state.value.creationFlow.draft.albumImport.coverUrl = 'http://localhost:9100/atoman-dev/music/covers/uploads/users/u1/2026/07/cover.jpg'

    const wrapper = mount(MusicCreationAlbumSeedStep)

    const image = wrapper.get('[data-testid="album-import-cover-preview"]')
    expect(image.attributes('src')).toBe('http://localhost:9100/atoman-dev/music/covers/uploads/users/u1/2026/07/cover.jpg')
    expect(wrapper.text()).not.toContain('http://localhost:9100/atoman-dev/music/covers/uploads/users/u1/2026/07/cover.jpg')
  })

  it('选择 zip 后立即切到详情填写步骤', async () => {
    let resolveUpload: (() => void) | null = null

    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue({
      importId: 'import-2',
      status: 'pending_upload',
      archiveName: '',
      uploadProgress: 0,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })
    vi.spyOn(musicApi, 'uploadMusicAlbumArchiveMultipart').mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        resolveUpload = resolve
      })
      return {
        importId: 'import-2',
        status: 'ready',
        archiveName: 'graduation.zip',
        uploadProgress: 100,
        uploadSpeed: 0,
        derivedAlbumTitle: 'Graduation',
        derivedCover: '',
        derivedTracks: [],
        coverUrl: '',
        coverKey: '',
        lastSyncedAt: '',
        errorMessage: '',
      }
    })

    const wrapper = mount(MusicCreationAlbumSeedStep)
    const drawers = useMusicDrawers()
    const file = new File(['zip'], 'graduation.zip', { type: 'application/zip' })
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })

    const pending = wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(drawers.state.value.creationFlow?.step).toBe('albumDetails')

    resolveUpload?.()
    await pending
  })

  it('Seed 触发上传并切到详情页后禁用详情页压缩包入口', async () => {
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue({
      importId: 'import-uploading',
      status: 'pending_upload',
      archiveName: '',
      uploadProgress: 0,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })
    vi.spyOn(musicApi, 'uploadMusicAlbumArchive').mockResolvedValue()
    vi.spyOn(musicApi, 'uploadMusicAlbumArchiveMultipart').mockImplementation(async (_importId, _file, options) => {
      options?.onProgress?.({ loaded: 256_000, total: 1_024_000, bytesPerSecond: 128_000 })
      await new Promise<never>(() => {})
    })

    const seedWrapper = mount(MusicCreationAlbumSeedStep)
    const drawers = useMusicDrawers()
    const file = new File(['zip'], 'uploading.zip', { type: 'application/zip' })
    const seedInput = seedWrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    Object.defineProperty(seedInput, 'files', { configurable: true, value: [file] })

    void seedWrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(drawers.state.value.creationFlow?.step).toBe('albumDetails')

    const detailsWrapper = mount(MusicCreationAlbumDetailsStep)
    const detailsInput = detailsWrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement

    expect(detailsInput.disabled).toBe(true)
    expect(detailsWrapper.get('[data-testid="album-import-status"]').text()).toContain('上传中')
    expect(musicApi.uploadMusicAlbumArchive).not.toHaveBeenCalled()
    expect(musicApi.uploadMusicAlbumArchiveMultipart).toHaveBeenCalledWith(
      'import-uploading',
      file,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    )
  })

  it('详情页 ready 后重新选择压缩包时创建新 import session 并走 multipart', async () => {
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue({
      importId: 'import-replacement',
      status: 'pending_upload',
      archiveName: '',
      uploadProgress: 0,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })
    vi.spyOn(musicApi, 'uploadMusicAlbumArchive').mockResolvedValue()
    vi.spyOn(musicApi, 'uploadMusicAlbumArchiveMultipart').mockResolvedValue({
      importId: 'import-replacement',
      status: 'ready',
      archiveName: 'replacement.zip',
      uploadProgress: 100,
      uploadSpeed: 0,
      derivedAlbumTitle: 'Replacement',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.setMusicCreationStep('albumDetails')
    if (!drawers.state.value.creationFlow) throw new Error('creation flow missing')
    drawers.state.value.creationFlow.draft.albumImport.importId = 'import-existing'
    drawers.state.value.creationFlow.draft.albumImport.status = 'ready'
    drawers.state.value.creationFlow.draft.albumImport.archiveName = 'existing.zip'

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const file = new File(['zip'], 'replacement.zip', { type: 'application/zip' })
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(musicApi.createMusicAlbumImport).toHaveBeenCalledWith({ artistId: 'artist-seeded' })
    expect(musicApi.uploadMusicAlbumArchive).not.toHaveBeenCalled()
    expect(musicApi.uploadMusicAlbumArchiveMultipart).toHaveBeenCalledWith(
      'import-replacement',
      file,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    )
    expect(drawers.state.value.creationFlow.draft.albumDetails.title).toBe('Replacement')
  })

  it('详情页 failed 后重新选择压缩包时复用旧 importId 并走 multipart', async () => {
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue({
      importId: 'unexpected-import',
      status: 'pending_upload',
      archiveName: '',
      uploadProgress: 0,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })
    vi.spyOn(musicApi, 'uploadMusicAlbumArchive').mockResolvedValue()
    vi.spyOn(musicApi, 'uploadMusicAlbumArchiveMultipart').mockResolvedValue({
      importId: 'import-failed',
      status: 'ready',
      archiveName: 'retry.zip',
      uploadProgress: 100,
      uploadSpeed: 0,
      derivedAlbumTitle: 'Retry Album',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.setMusicCreationStep('albumDetails')
    if (!drawers.state.value.creationFlow) throw new Error('creation flow missing')
    drawers.state.value.creationFlow.draft.albumImport.importId = 'import-failed'
    drawers.state.value.creationFlow.draft.albumImport.status = 'failed'
    drawers.state.value.creationFlow.draft.albumImport.archiveName = 'failed.zip'

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const file = new File(['zip'], 'retry.zip', { type: 'application/zip' })
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(musicApi.createMusicAlbumImport).not.toHaveBeenCalled()
    expect(musicApi.uploadMusicAlbumArchive).not.toHaveBeenCalled()
    expect(musicApi.uploadMusicAlbumArchiveMultipart).toHaveBeenCalledWith(
      'import-failed',
      file,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    )
    expect(drawers.state.value.creationFlow.draft.albumDetails.title).toBe('Retry Album')
  })

  it('超过 2GB 的 zip 在本地拦截且不创建导入会话', async () => {
    vi.spyOn(musicApi, 'createMusicAlbumImport').mockResolvedValue({
      importId: 'import-too-large',
      status: 'pending_upload',
      archiveName: '',
      uploadProgress: 0,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })
    vi.spyOn(musicApi, 'uploadMusicAlbumArchiveMultipart').mockResolvedValue({
      importId: 'import-too-large',
      status: 'ready',
      archiveName: 'too-large.zip',
      uploadProgress: 100,
      uploadSpeed: 0,
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      coverUrl: '',
      coverKey: '',
      lastSyncedAt: '',
      errorMessage: '',
    })

    const wrapper = mount(MusicCreationAlbumSeedStep)
    const file = new File(['zip'], 'too-large.zip', { type: 'application/zip' })
    Object.defineProperty(file, 'size', { configurable: true, value: (2 * 1024 * 1024 * 1024) + 1 })
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('文件需在 2GB 以内，请转换或压缩后上传')
    expect(musicApi.createMusicAlbumImport).not.toHaveBeenCalled()
  })
})
