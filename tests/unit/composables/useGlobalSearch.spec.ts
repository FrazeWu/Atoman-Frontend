import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { referenceApi, type ReferenceTarget } from '../../../src/api/references'
import {
  useGlobalSearch,
  type GlobalSearchItem,
  type GlobalSearchSection,
} from '../../../src/composables/useGlobalSearch'
import type { ModuleRoomKey } from '../../../src/config/moduleRooms'

vi.mock('@/api/references', () => ({
  referenceApi: {
    search: vi.fn(),
  },
}))

const target = (value: Partial<ReferenceTarget> & Pick<ReferenceTarget, 'type' | 'id' | 'label' | 'module' | 'path'>): ReferenceTarget => ({
  available: true,
  ...value,
})

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('groups unified reference results and builds module paths', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([
      target({ type: 'user', id: 'user-1', label: 'Alice', subtitle: '@alice', module: 'blog', path: '/users/alice' }),
      target({ type: 'post', id: 'post-1', label: 'Blog Post', module: 'blog', path: '/post/post-1' }),
      target({ type: 'thread', id: 'thread-1', label: 'Forum Topic', module: 'forum', path: '/topic/thread-1' }),
      target({ type: 'album', id: 'album-1', label: 'Album Name', module: 'music', path: '/album/album-1' }),
      target({ type: 'video', id: 'video-1', label: 'Video', module: 'video', path: '/videos/watch/video-1' }),
    ])

    const search = useGlobalSearch()
    await search.search('atom')

    const [targetTypes] = vi.mocked(referenceApi.search).mock.calls[0] ?? []
    expect(targetTypes).toEqual(expect.arrayContaining([
      'user', 'channel', 'collection', 'post', 'article', 'feed', 'song',
    ]))
    expect(targetTypes).not.toContain('comment')
    expect(referenceApi.search).toHaveBeenCalledWith(targetTypes, 'atom', 2, expect.any(AbortSignal))
    expect(search.sections.value.map((section: GlobalSearchSection) => section.type)).toEqual(['user', 'blog', 'forum', 'music', 'video'])
    expect(search.sections.value[0]?.items[0]).toMatchObject({ title: 'Alice', href: '/users/alice', meta: '用户' })
    expect(search.sections.value[1]?.items[0]).toMatchObject({ title: 'Blog Post', href: '/posts/post/post-1', meta: '文章' })
    expect(search.sections.value[2]?.items[0]).toMatchObject({ title: 'Forum Topic', href: '/forum/topic/thread-1' })
    expect(search.sections.value[3]?.items[0]).toMatchObject({ title: 'Album Name', href: '/music/album/album-1' })
    expect(search.sections.value[4]?.items[0]).toMatchObject({ title: 'Video', href: '/videos/watch/video-1' })
  })

  it('filters results from disabled modules', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([
      target({ type: 'post', id: 'post-1', label: 'Blog Post', module: 'blog', path: '/post/post-1' }),
      target({ type: 'video', id: 'video-1', label: 'Video', module: 'video', path: '/videos/watch/video-1' }),
    ])

    const search = useGlobalSearch({ isModuleVisible: (module: ModuleRoomKey) => module !== 'video' })
    await search.search('atom')

    expect(search.sections.value.map((section: GlobalSearchSection) => section.type)).toEqual(['blog'])
  })

  it('mixes resource types within the same module preview', async () => {
    vi.mocked(referenceApi.search).mockResolvedValue([
      target({ type: 'artist', id: 'artist-1', label: 'First Artist', module: 'music', path: '/artist/artist-1' }),
      target({ type: 'artist', id: 'artist-2', label: 'Second Artist', module: 'music', path: '/artist/artist-2' }),
      target({ type: 'album', id: 'album-1', label: 'Album', module: 'music', path: '/album/album-1' }),
    ])

    const search = useGlobalSearch()
    await search.search('atom')

    expect(search.sections.value[0]?.items.map((item: GlobalSearchItem) => item.title)).toEqual(['First Artist', 'Album'])
  })

  it('reports request failures instead of presenting them as empty results', async () => {
    vi.mocked(referenceApi.search).mockRejectedValue(new Error('network unavailable'))

    const search = useGlobalSearch()
    await search.search('atom')

    expect(search.sections.value).toEqual([])
    expect(search.error.value).toBe('搜索暂不可用')
    expect(search.loading.value).toBe(false)
  })

  it('keeps the newest result when an older request finishes later', async () => {
    let resolveFirst: ((items: ReferenceTarget[]) => void) | undefined
    vi.mocked(referenceApi.search)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce([
        target({ type: 'post', id: 'new', label: 'New Result', module: 'blog', path: '/post/new' }),
      ])

    const search = useGlobalSearch()
    const first = search.search('first')
    await search.search('second')
    resolveFirst?.([
      target({ type: 'post', id: 'old', label: 'Old Result', module: 'blog', path: '/post/old' }),
    ])
    await first

    expect(search.sections.value[0]?.items[0]?.title).toBe('New Result')
  })

  it('debounces preview searches', async () => {
    vi.useFakeTimers()
    vi.mocked(referenceApi.search).mockResolvedValue([])
    const search = useGlobalSearch()

    search.scheduleSearch('atom')
    await vi.advanceTimersByTimeAsync(249)
    expect(referenceApi.search).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(referenceApi.search).toHaveBeenCalledOnce()
  })
})
