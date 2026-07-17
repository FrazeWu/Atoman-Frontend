import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import CreateArtistView from '@/views/music/CreateArtistView.vue'

const mocks = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  routeQuery: { name: 'Seed Artist' } as Record<string, unknown>,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
  useRoute: () => ({
    query: mocks.routeQuery,
  }),
}))

describe('CreateArtistView.vue', () => {
  beforeEach(() => {
    mocks.routerReplace.mockReset()
    mocks.routeQuery = { name: 'Seed Artist' }
  })

  it('bridges the legacy route to the unified creation entry and carries the seeded name', async () => {
    mount(CreateArtistView)
    await flushPromises()

    expect(mocks.routerReplace).toHaveBeenCalledWith('/music?editor=artist-create&name=Seed+Artist')
  })

  it('bridges the legacy route without name seed when query is empty', async () => {
    mocks.routeQuery = {}

    mount(CreateArtistView)
    await flushPromises()

    expect(mocks.routerReplace).toHaveBeenCalledWith('/music?editor=artist-create')
  })
})
