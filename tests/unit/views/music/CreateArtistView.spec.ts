import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import CreateArtistView from '@/views/music/CreateArtistView.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routeQuery: { name: 'Seed Artist' } as Record<string, unknown>,
  createMusicArtist: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
  }),
  useRoute: () => ({
    query: mocks.routeQuery,
  }),
}))

vi.mock('@/api/musicV1', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/musicV1')>()
  return {
    ...actual,
    createMusicArtist: mocks.createMusicArtist,
  }
})

describe('CreateArtistView.vue', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset()
    mocks.createMusicArtist.mockReset()
    mocks.routeQuery = { name: 'Seed Artist' }
    mocks.createMusicArtist.mockResolvedValue({
      id: 'artist-123',
      name: 'Seed Artist',
      bio: 'Artist bio',
      entry_status: 'open',
    })
  })

  it('prefills the name from route query and redirects to the music view with the new artist selected after submit', async () => {
    const wrapper = mount(CreateArtistView)

    const nameInput = wrapper.get('[data-test="artist-name-input"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('Seed Artist')

    await wrapper.get('[data-test="artist-bio-input"]').setValue('Artist bio')
    await wrapper.get('[data-test="artist-form"]').trigger('submit')
    await flushPromises()

    expect(mocks.createMusicArtist).toHaveBeenCalledWith({
      name: 'Seed Artist',
      bio: 'Artist bio',
    })
    expect(mocks.routerPush).toHaveBeenCalledWith('/music?artist=artist-123')
  })

  it('falls back to the music module root when creation succeeds without entity id', async () => {
    mocks.createMusicArtist.mockResolvedValueOnce({
      id: '',
      name: 'Seed Artist',
      entry_status: 'open',
    })

    const wrapper = mount(CreateArtistView)

    await wrapper.get('[data-test="artist-form"]').trigger('submit')
    await flushPromises()

    expect(mocks.routerPush).toHaveBeenCalledWith('/music')
  })
})
