import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationAlbumDetailsStep from '@/components/music/MusicCreationAlbumDetailsStep.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  createMusicAlbumImport,
  listMusicArtists,
  uploadMusicAlbumArchiveMultipart,
  uploadMusicAsset,
  validateMusicAlbumArchiveFile,
} from '@/api/musicV1'

vi.mock('@/api/musicV1', () => ({
  uploadMusicAsset: vi.fn(),
  createMusicAlbumImport: vi.fn(),
  listMusicArtists: vi.fn(),
  uploadMusicAlbumArchiveMultipart: vi.fn(),
  validateMusicAlbumArchiveFile: vi.fn(),
}))

vi.mock('@/components/music/MusicSquareImageCropSheet.vue', () => ({
  default: {
    props: ['show'],
    emits: ['confirm', 'cancel'],
    template: `
      <div v-if="show" data-testid="music-square-crop-sheet">
        <button data-testid="music-square-crop-confirm" @click="$emit('confirm', { type: 'image/png', name: 'cover-cropped.png' })">confirm</button>
        <button data-testid="music-square-crop-cancel" @click="$emit('cancel')">cancel</button>
      </div>
    `,
  },
}))

describe('MusicCreationAlbumDetailsStep.vue', () => {
  beforeEach(() => {
    const drawers = useMusicDrawers()
    drawers.closeAll()
    vi.mocked(uploadMusicAsset).mockReset()
    vi.mocked(createMusicAlbumImport).mockReset()
    vi.mocked(listMusicArtists).mockReset()
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockReset()
    vi.mocked(validateMusicAlbumArchiveFile).mockReset()
  })

  it('renders album details fields in the confirmed order and shows seeded draft values', () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.albumDetails = {
      coverUrl: 'https://img.example/late-registration.jpg',
      title: 'Late Registration',
      contributors: [],
      releaseDateParts: {
        year: '2005',
        month: '08',
        day: '30',
      },
      releaseDate: '2005-08-30',
      releaseYear: '2005',
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
    expect(fieldOrder).toEqual(['cover', 'name', 'contributors', 'date', 'type', 'bio', 'track-adjustment', 'source'])

    expect(wrapper.get('[data-testid="album-details-progress-label"]').text()).toContain('第 3 步')
    expect(wrapper.get('[data-testid="album-details-progress-value"]').text()).toContain('3 / 3')
    expect(wrapper.findAll('[data-testid="album-details-step-label"]').map((node) => node.text())).toEqual([
      '1 创建艺术家',
      '2 专辑名 + 批量上传',
      '3 详细信息',
    ])
    expect(wrapper.get('[data-testid="album-details-title-input"]').element).toHaveValue('Late Registration')
    expect(wrapper.get('[data-testid="album-details-date-year-input"]').element).toHaveValue('2005')
    expect(wrapper.get('[data-testid="album-details-date-month-input"]').element).toHaveValue('08')
    expect(wrapper.get('[data-testid="album-details-date-day-input"]').element).toHaveValue('30')
    expect(wrapper.get('[data-testid="album-details-type-input"]').element).toHaveValue('album')
    expect(wrapper.get('[data-testid="album-details-bio-input"]').element).toHaveValue('second studio album')
    expect(wrapper.get('[data-testid="album-details-source-input"]').element).toHaveValue('https://en.wikipedia.org/wiki/Late_Registration')
    expect(wrapper.get('[data-testid="album-details-track-count"]').text()).toContain('3 首')
  })

  it('searches existing artists, adds contributors, and allows removing unlocked contributors', async () => {
    vi.mocked(listMusicArtists).mockResolvedValue({
      data: [
        {
          id: 'artist-1',
          name: 'Bladee',
          image_url: 'https://img.example/bladee.png',
          entry_status: 'open',
        },
        {
          id: 'artist-2',
          name: 'Ecco2k',
          image_url: 'https://img.example/ecco2k.png',
          members: '2',
          entry_status: 'open',
        },
      ],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded', artistName: 'Seeded Artist' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.albumDetails.contributors = []

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    await wrapper.get('[data-testid="album-contributor-search-input"]').setValue('blade')
    await flushPromises()
    await wrapper.get('[data-testid="album-contributor-option-artist-1"]').trigger('mousedown')
    await flushPromises()

    expect(flow.draft.albumDetails.contributors).toEqual([
      expect.objectContaining({
        artistId: 'artist-1',
        name: 'Bladee',
        avatarUrl: 'https://img.example/bladee.png',
        kind: 'person',
        locked: false,
      }),
    ])
    expect(wrapper.get('[data-testid="album-contributor-chip-artist-1"]').text()).toContain('Bladee')
    expect(wrapper.get('[data-testid="album-contributor-chip-artist-1"]').text()).toContain('个人')

    await wrapper.get('[data-testid="album-contributor-remove-artist-1"]').trigger('click')

    expect(flow.draft.albumDetails.contributors).toEqual([])
  })

  it('keeps the new artist contributor locked in the first-album flow', async () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow()
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.artist.kind = 'group'
    flow.draft.artist.stageNames[0].name = 'Sweet Trip'

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    await flushPromises()

    expect(flow.draft.albumDetails.contributors).toEqual([
      expect.objectContaining({
        artistId: null,
        name: 'Sweet Trip',
        kind: 'group',
        locked: true,
      }),
    ])
    expect(wrapper.get('[data-testid="album-contributor-chip-new-artist"]').text()).toContain('Sweet Trip')
    expect(wrapper.get('[data-testid="album-contributor-chip-new-artist"]').text()).toContain('组合')
    expect(wrapper.find('[data-testid="album-contributor-remove-new-artist"]').exists()).toBe(false)
  })

  it('uses releaseDateParts as the primary release date draft and derives legacy fields', async () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    await wrapper.get('[data-testid="album-details-date-year-input"]').setValue('2005')
    await wrapper.get('[data-testid="album-details-date-month-input"]').setValue('8')
    await wrapper.get('[data-testid="album-details-date-day-input"]').setValue('30')

    expect(flow.draft.albumDetails.releaseDateParts).toEqual({
      year: '2005',
      month: '8',
      day: '30',
    })
    expect(flow.draft.albumDetails.releaseDate).toBe('2005-08-30')
    expect(flow.draft.albumDetails.releaseYear).toBe('2005')
  })

  it('backfills releaseDateParts.year from legacy releaseYear when releaseDate is missing', () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.albumDetails.releaseDateParts = {
      year: '',
      month: '',
      day: '',
    }
    flow.draft.albumDetails.releaseDate = ''
    flow.draft.albumDetails.releaseYear = '2007'

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    expect(wrapper.get('[data-testid="album-details-date-year-input"]').element).toHaveValue('2007')
    expect(flow.draft.albumDetails.releaseDateParts).toEqual({
      year: '2007',
      month: '',
      day: '',
    })
    expect(flow.draft.albumDetails.releaseDate).toBe('')
    expect(flow.draft.albumDetails.releaseYear).toBe('2007')
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

  it('supports drag sorting and keeps track sequence continuous after drop', async () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.tracks = [
      { id: 'track-1', sequence: 1, title: 'A' },
      { id: 'track-2', sequence: 2, title: 'B' },
      { id: 'track-3', sequence: 3, title: 'C' },
    ]

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'track-3'),
      dropEffect: 'move',
      effectAllowed: 'move',
    }

    await wrapper.get('[data-testid="album-track-row-track-3"]').trigger('dragstart', { dataTransfer })
    await wrapper.get('[data-testid="album-track-row-track-1"]').trigger('dragover', { preventDefault: vi.fn(), dataTransfer })
    await wrapper.get('[data-testid="album-track-row-track-1"]').trigger('drop', { preventDefault: vi.fn(), dataTransfer })

    expect(flow.draft.tracks.map((track) => track.id)).toEqual(['track-3', 'track-1', 'track-2'])
    expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3])
    expect(wrapper.findAll('[data-testid="album-track-sequence"]').map((node) => node.text())).toEqual(['01', '02', '03'])
    expect(flow.tracksCustomized).toBe(true)
  })

  it('supports dragging downward with the expected final order', async () => {
    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.tracks = [
      { id: 'track-1', sequence: 1, title: 'A' },
      { id: 'track-2', sequence: 2, title: 'B' },
      { id: 'track-3', sequence: 3, title: 'C' },
    ]

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'track-1'),
      dropEffect: 'move',
      effectAllowed: 'move',
    }

    await wrapper.get('[data-testid="album-track-row-track-1"]').trigger('dragstart', { dataTransfer })
    await wrapper.get('[data-testid="album-track-row-track-3"]').trigger('dragover', { preventDefault: vi.fn(), dataTransfer })
    await wrapper.get('[data-testid="album-track-row-track-3"]').trigger('drop', { preventDefault: vi.fn(), dataTransfer })

    expect(flow.draft.tracks.map((track) => track.id)).toEqual(['track-2', 'track-1', 'track-3'])
    expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3])
  })

  it('does not overwrite customized tracks when a new ready import snapshot arrives', async () => {
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Imported Album',
      derivedCover: 'https://img.example/imported-cover.jpg',
      derivedTracks: [
        { title: 'Imported A', audioKey: 'audio-a', origin: 'import' },
        { title: 'Imported B', audioKey: 'audio-b', origin: 'import' },
      ],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.tracksCustomized = true
    flow.draft.tracks = [
      { id: 'manual-1', sequence: 1, title: 'Manual Intro' },
      { id: 'manual-2', sequence: 2, title: 'Manual Outro' },
    ]

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const file = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(flow.draft.albumDetails.title).toBe('Imported Album')
    expect(flow.draft.tracks).toEqual([
      { id: 'manual-1', sequence: 1, title: 'Manual Intro' },
      { id: 'manual-2', sequence: 2, title: 'Manual Outro' },
    ])
  })

  it('does not overwrite manually edited track titles when a new ready import snapshot arrives', async () => {
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Imported Album',
      derivedCover: 'https://img.example/imported-cover.jpg',
      derivedTracks: [
        { title: 'Imported A', audioKey: 'audio-a', origin: 'import' },
        { title: 'Imported B', audioKey: 'audio-b', origin: 'import' },
      ],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.tracks = [
      { id: 'track-1', sequence: 1, title: 'Original A' },
      { id: 'track-2', sequence: 2, title: 'Original B' },
    ]

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    await wrapper.findAll('[data-testid="album-track-title-input"]')[0].setValue('Manual Intro')

    expect(flow.tracksCustomized).toBe(true)

    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const file = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(flow.draft.tracks).toEqual([
      { id: 'track-1', sequence: 1, title: 'Manual Intro' },
      { id: 'track-2', sequence: 2, title: 'Original B' },
    ])
  })

  it('does not apply imported cover as final cover before crop confirmation', async () => {
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Imported Album',
      derivedCover: 'https://img.example/imported-cover.jpg',
      derivedTracks: [],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const file = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(flow.draft.albumDetails.coverUrl).toBe('')
    expect(wrapper.find('[data-testid="album-details-imported-cover-callout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(true)
  })

  it('does not let imported cover overwrite a manually confirmed final cover', async () => {
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/manual-cover.png',
      url: 'https://img.example/manual-cover.png',
    })
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Imported Album',
      derivedCover: 'https://img.example/imported-cover.jpg',
      derivedTracks: [],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const manualInput = wrapper.get('[data-testid="album-details-cover-input"]').element as HTMLInputElement
    const manualFile = new File(['manual'], 'manual.png', { type: 'image/png' })
    Object.defineProperty(manualInput, 'files', {
      configurable: true,
      value: [manualFile],
    })

    await wrapper.get('[data-testid="album-details-cover-input"]').trigger('change')
    await wrapper.get('[data-testid="music-square-crop-confirm"]').trigger('click')
    await flushPromises()

    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const file = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(flow.draft.albumDetails.coverUrl).toBe('https://img.example/manual-cover.png')
    expect(wrapper.find('[data-testid="album-details-imported-cover-callout"]').exists()).toBe(true)
  })

  it('does not overwrite a manually edited title when a new ready import snapshot arrives', async () => {
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Imported Album',
      derivedCover: '',
      derivedTracks: [],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    flow.draft.albumDetails.title = 'Manual Title'
    flow.titleCustomized = true

    const wrapper = mount(MusicCreationAlbumDetailsStep)
    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const file = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(flow.draft.albumDetails.title).toBe('Manual Title')
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

  it('opens square crop sheet before applying manual album cover preview', async () => {
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/cover-cropped.png',
      url: 'https://img.example/cover-cropped.png',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    const input = wrapper.get('[data-testid="album-details-cover-input"]').element as HTMLInputElement
    const file = new File(['cover'], 'cover.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-details-cover-input"]').trigger('change')

    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(true)
    expect(vi.mocked(uploadMusicAsset)).not.toHaveBeenCalled()
    expect(flow.draft.albumDetails.coverUrl).toBe('')

    await wrapper.get('[data-testid="music-square-crop-confirm"]').trigger('click')
    await flushPromises()

    expect(vi.mocked(uploadMusicAsset)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadMusicAsset).mock.calls[0]?.[1]).toBe('music.cover')
    expect(flow.draft.albumDetails.coverUrl).toBe('https://img.example/cover-cropped.png')
    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(false)
  })

  it('requires square crop confirmation before applying imported cover preview', async () => {
    vi.mocked(uploadMusicAsset).mockResolvedValue({
      key: 'music/imported-cover-cropped.png',
      url: 'https://img.example/imported-cover-cropped.png',
    })
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Graduation',
      derivedCover: 'https://img.example/imported-cover.jpg',
      derivedTracks: [],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const file = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(flow.draft.albumImport.derivedCover).toBe('https://img.example/imported-cover.jpg')
    expect(flow.draft.albumDetails.coverUrl).toBe('')
    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(true)

    await wrapper.get('[data-testid="music-square-crop-confirm"]').trigger('click')
    await flushPromises()

    expect(vi.mocked(uploadMusicAsset)).toHaveBeenCalledTimes(1)
  })

  it('reopens imported cover crop after cancel for the same recognized cover url', async () => {
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Graduation',
      derivedCover: 'https://img.example/imported-cover.jpg',
      derivedTracks: [],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    const input = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const file = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(true)

    await wrapper.get('[data-testid="music-square-crop-cancel"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(false)
    expect(vi.mocked(uploadMusicAsset)).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="album-details-imported-cover-action"]').text()).toContain('继续裁剪识别封面')

    await wrapper.get('[data-testid="album-details-imported-cover-action"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="music-square-crop-sheet"]').exists()).toBe(true)
  })

  it('keeps imported cover as a pending option after a manual cover has been confirmed', async () => {
    vi.mocked(uploadMusicAsset)
      .mockResolvedValueOnce({
        key: 'music/manual-cover.png',
        url: 'https://img.example/manual-cover.png',
      })
    vi.mocked(createMusicAlbumImport).mockResolvedValue({
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
    })
    vi.mocked(uploadMusicAlbumArchiveMultipart).mockResolvedValue({
      importId: 'import-1',
      status: 'ready',
      archiveName: 'album.zip',
      uploadProgress: 100,
      uploadSpeed: 1024,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: 'Graduation',
      derivedCover: 'https://img.example/imported-cover.jpg',
      derivedTracks: [],
      lastSyncedAt: '2026-07-06T00:00:00Z',
      errorMessage: '',
    })

    const drawers = useMusicDrawers()
    drawers.openMusicCreationFlow({ artistId: 'artist-seeded' })
    drawers.setMusicCreationStep('albumDetails')

    const flow = drawers.state.value.creationFlow
    if (!flow) throw new Error('creation flow missing')

    const wrapper = mount(MusicCreationAlbumDetailsStep)

    const archiveInput = wrapper.get('[data-testid="album-import-archive-input"]').element as HTMLInputElement
    const archiveFile = new File(['zip'], 'album.zip', { type: 'application/zip' })
    Object.defineProperty(archiveInput, 'files', {
      configurable: true,
      value: [archiveFile],
    })

    await wrapper.get('[data-testid="album-import-archive-input"]').trigger('change')
    await flushPromises()

    expect(wrapper.find('[data-testid="album-details-imported-cover-callout"]').exists()).toBe(true)

    await wrapper.get('[data-testid="music-square-crop-cancel"]').trigger('click')
    await flushPromises()

    const manualInput = wrapper.get('[data-testid="album-details-cover-input"]').element as HTMLInputElement
    const manualFile = new File(['manual'], 'manual.png', { type: 'image/png' })
    Object.defineProperty(manualInput, 'files', {
      configurable: true,
      value: [manualFile],
    })

    await wrapper.get('[data-testid="album-details-cover-input"]').trigger('change')
    await wrapper.get('[data-testid="music-square-crop-confirm"]').trigger('click')
    await flushPromises()

    expect(flow.draft.albumDetails.coverUrl).toBe('https://img.example/manual-cover.png')
    expect(wrapper.find('[data-testid="album-details-imported-cover-callout"]').exists()).toBe(true)
  })
})
