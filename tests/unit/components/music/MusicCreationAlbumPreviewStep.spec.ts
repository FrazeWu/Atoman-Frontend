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
})
