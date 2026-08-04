import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import MusicCreationAlbumPreviewStep from '@/components/music/MusicCreationAlbumPreviewStep.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('MusicCreationAlbumPreviewStep.vue', () => {
  beforeEach(() => {
    const drawers = useMusicDrawers()
    drawers.closeAll()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded', startStep: 'preview' })
  })

  afterEach(() => {
    useMusicDrawers().closeAll()
  })

  it('展示处理失败的已上传文件', () => {
    const drawers = useMusicDrawers()
    if (!drawers.state.value.creationFlow) throw new Error('creation flow missing')

    drawers.state.value.creationFlow.draft.albumImport.files = [{
      fileId: 'file-1',
      relativePath: 'broken.mp3',
      fileName: 'broken.mp3',
      role: 'audio',
      detectedFormat: 'mp3',
      size: 1,
      uploadStatus: 'uploaded',
      processingStatus: 'failed',
      discNumber: 1,
      trackNumber: 1,
      title: '',
      errorMessage: '转码失败',
    }]

    const wrapper = mount(MusicCreationAlbumPreviewStep)

    expect(wrapper.get('.album-preview-step__failures').text()).toContain('broken.mp3：转码失败')
  })

  it('展示导入会话的失败原因', () => {
    const drawers = useMusicDrawers()
    if (!drawers.state.value.creationFlow) throw new Error('creation flow missing')

    drawers.state.value.creationFlow.draft.albumImport.status = 'failed'
    drawers.state.value.creationFlow.draft.albumImport.stage = 'failed'
    drawers.state.value.creationFlow.draft.albumImport.errorMessage = '压缩包已加密，请上传无密码压缩包或直接上传音频文件'

    const wrapper = mount(MusicCreationAlbumPreviewStep)

    expect(wrapper.text()).toContain('处理失败')
    expect(wrapper.text()).toContain('压缩包已加密，请上传无密码压缩包或直接上传音频文件')
  })
})
