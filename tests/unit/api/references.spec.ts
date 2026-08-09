import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPostJson } from '@/api/client'
import { referenceApi } from '@/api/references'

vi.mock('@/api/client', () => ({
  apiGet: vi.fn(),
  apiPostJson: vi.fn(),
}))

vi.mock('@/composables/useApi', () => ({
  useApiUrl: () => 'https://api.atoman.org/api/v1',
}))

describe('referenceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the configured API origin for search', async () => {
    vi.mocked(apiGet).mockResolvedValue([])

    await referenceApi.search(['post', 'thread'], 'atom', 2)

    expect(apiGet).toHaveBeenCalledWith(
      'https://api.atoman.org/api/v1/references/search?q=atom&limit=2&type=post&type=thread',
      { signal: undefined },
    )
  })

  it('uses the configured API origin for resolve', async () => {
    vi.mocked(apiPostJson).mockResolvedValue([])

    await referenceApi.resolve('@alice')

    expect(apiPostJson).toHaveBeenCalledWith(
      'https://api.atoman.org/api/v1/references/resolve',
      { content: '@alice' },
    )
  })
})
