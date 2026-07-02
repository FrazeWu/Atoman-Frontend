import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicCreationAlbumDetailsStep from '@/components/music/MusicCreationAlbumDetailsStep.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

describe('MusicCreationAlbumDetailsStep.vue', () => {
  it('renders album details fields in the confirmed order and shows seeded draft values', () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.albumDetails = {
      coverUrl: 'https://img.example/late-registration.jpg',
      title: 'Late Registration',
      releaseDate: '2005-08-30',
      type: 'album',
      bio: 'second studio album',
      source: 'https://en.wikipedia.org/wiki/Late_Registration',
    }
    flow.draft.tracks = [
      { id: 'track-1', sequence: 1, title: 'Wake Up Mr. West', audioUrl: 'https://audio/1.mp3' },
      { id: 'track-2', sequence: 2, title: 'Heard Em Say', audioUrl: 'https://audio/2.mp3' },
      { id: 'track-3', sequence: 3, title: 'Touch the Sky', audioUrl: 'https://audio/3.mp3' },
    ]

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    const fieldOrder = wrapper.findAll('[data-testid="album-details-field"]').map((node) => node.attributes('data-field'))
    expect(fieldOrder).toEqual(['cover', 'name', 'date', 'type', 'bio', 'track-adjustment', 'source'])

    expect(wrapper.get('[data-testid="album-details-progress-label"]').text()).toContain('第 3 步')
    expect(wrapper.get('[data-testid="album-details-progress-value"]').text()).toContain('3 / 3')
    expect(wrapper.findAll('[data-testid="album-details-step-label"]').map((node) => node.text())).toEqual([
      '1 创建艺术家',
      '2 专辑名 + 批量上传',
      '3 详细信息',
    ])
    expect(wrapper.get('[data-testid="album-details-title-input"]').element).toHaveValue('Late Registration')
    expect(wrapper.get('[data-testid="album-details-date-input"]').element).toHaveValue('2005-08-30')
    expect(wrapper.get('[data-testid="album-details-type-input"]').element).toHaveValue('album')
    expect(wrapper.get('[data-testid="album-details-bio-input"]').element).toHaveValue('second studio album')
    expect(wrapper.get('[data-testid="album-details-source-input"]').element).toHaveValue('https://en.wikipedia.org/wiki/Late_Registration')
    expect(wrapper.get('[data-testid="album-details-track-count"]').text()).toContain('3 首')
  })

  it('supports track move up, move down, and delete within the draft while keeping visible sequence labels', async () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.tracks = [
      { id: 'track-1', sequence: 1, title: 'Wake Up Mr. West', audioUrl: 'https://audio/1.mp3' },
      { id: 'track-2', sequence: 2, title: 'Heard Em Say', audioUrl: 'https://audio/2.mp3' },
      { id: 'track-3', sequence: 3, title: 'Touch the Sky', audioUrl: 'https://audio/3.mp3' },
    ]

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    expect(wrapper.findAll('[data-testid="album-track-sequence"]').map((node) => node.text())).toEqual(['01', '02', '03'])
    expect(wrapper.findAll('[data-testid="album-track-title-input"]').map((node) => (node.element as HTMLInputElement).value)).toEqual([
      'Wake Up Mr. West',
      'Heard Em Say',
      'Touch the Sky',
    ])

    await wrapper.get('[data-testid="album-track-move-up-track-2"]').trigger('click')

    expect(flow.draft.tracks.map((track) => track.id)).toEqual(['track-2', 'track-1', 'track-3'])
    expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3])
    expect(wrapper.findAll('[data-testid="album-track-title-input"]').map((node) => (node.element as HTMLInputElement).value)).toEqual([
      'Heard Em Say',
      'Wake Up Mr. West',
      'Touch the Sky',
    ])
    expect(wrapper.findAll('[data-testid="album-track-sequence"]').map((node) => node.text())).toEqual(['01', '02', '03'])

    await wrapper.get('[data-testid="album-track-move-down-track-2"]').trigger('click')

    expect(flow.draft.tracks.map((track) => track.id)).toEqual(['track-1', 'track-2', 'track-3'])
    expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3])

    await wrapper.get('[data-testid="album-track-delete-track-2"]').trigger('click')

    expect(flow.draft.tracks.map((track) => track.id)).toEqual(['track-1', 'track-3'])
    expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2])
    expect(wrapper.findAll('[data-testid="album-track-sequence"]').map((node) => node.text())).toEqual(['01', '02'])
  })

  it('renders a minimal non-dead-end footer with back, finish, and close affordances', async () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.albumDetails.title = 'Late Registration'
    flow.draft.tracks = [
      { id: 'track-1', sequence: 1, title: 'Wake Up Mr. West', audioUrl: 'https://audio/1.mp3' },
    ]

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    expect(wrapper.get('[data-testid="album-details-footer"]').text()).toContain('返回上一步')
    expect(wrapper.get('[data-testid="album-details-footer"]').text()).toContain('完成')
    expect(wrapper.get('[data-testid="album-details-footer"]').text()).toContain('关闭')

    await wrapper.get('[data-testid="album-details-back-button"]').trigger('click')
    expect(drawers.state.value.creationFlow?.step).toBe('albumImport')

    drawers.setMusicCreationStep('albumDetails')
    await wrapper.get('[data-testid="album-details-close-button"]').trigger('click')
    expect(drawers.state.value.creationFlow).toBeNull()
  })

  it('在上传中也展示详情表单，并在顶部显示导入进度', () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.albumImport.archiveName = 'graduation.zip'
    flow.draft.albumImport.status = 'uploading'
    flow.draft.albumImport.uploadProgress = 37
    flow.draft.albumImport.uploadSpeed = 128 * 1024

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    expect(wrapper.get('[data-testid="album-import-status"]').text()).toContain('上传中')
    expect(wrapper.get('[data-testid="album-import-status"]').text()).toContain('graduation.zip')
    expect(wrapper.get('[data-testid="album-import-status"]').text()).toContain('上传进度 37%')
    expect(wrapper.get('[data-testid="album-import-status"]').text()).toContain('128 KB/s')
    expect(wrapper.get('[data-testid="album-details-title-input"]').exists()).toBe(true)
  })
})
