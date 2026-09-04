import { afterEach, describe, expect, it, vi } from 'vitest'
import { referenceApi, type ReferenceTarget } from '@/api/references'
import { useReferenceSearch } from '@/composables/useReferenceSearch'

vi.mock('@/api/references', () => ({
  referenceApi: {
    search: vi.fn(),
  },
}))

const target = (id: string): ReferenceTarget => ({
  id,
  type: 'video',
  label: id,
  module: 'video',
  path: `/videos/watch/${id}`,
  available: true,
})

describe('useReferenceSearch', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('delays a search and exposes the returned targets', async () => {
    vi.useFakeTimers()
    vi.mocked(referenceApi.search).mockResolvedValue([target('video-1')])
    const search = useReferenceSearch({ targetTypes: ['video'], limit: 12 })

    search.schedule('  video  ')
    expect(search.loading.value).toBe(true)
    await vi.advanceTimersByTimeAsync(249)
    expect(referenceApi.search).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(referenceApi.search).toHaveBeenCalledWith(['video'], 'video', 12, expect.any(AbortSignal))
    expect(search.results.value).toEqual([target('video-1')])
    expect(search.loading.value).toBe(false)
  })

  it('aborts a superseded request and ignores its late result', async () => {
    let resolveFirst: (value: ReferenceTarget[]) => void
    const firstResult = new Promise<ReferenceTarget[]>((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(referenceApi.search)
      .mockReturnValueOnce(firstResult)
      .mockResolvedValueOnce([target('new')])
    const search = useReferenceSearch({ targetTypes: ['video'], limit: 12 })

    const first = search.search('old')
    await search.search('new')
    const firstSignal = vi.mocked(referenceApi.search).mock.calls[0]?.[3]
    expect(firstSignal?.aborted).toBe(true)

    resolveFirst!([target('old')])
    await first
    expect(search.results.value).toEqual([target('new')])
  })
})
