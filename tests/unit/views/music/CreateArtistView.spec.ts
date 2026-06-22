import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import CreateArtistView from '@/views/music/CreateArtistView.vue'

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routeQuery: { name: 'Seed Artist' } as Record<string, unknown>,
  submitMusicEdit: vi.fn(),
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
    submitMusicEdit: mocks.submitMusicEdit,
  }
})

describe('CreateArtistView.vue', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset()
    mocks.submitMusicEdit.mockReset()
    mocks.routeQuery = { name: 'Seed Artist' }
    mocks.submitMusicEdit.mockResolvedValue({
      id: 'edit-1',
      type: 'create_artist',
      status: 'applied',
      entity_type: 'artist',
      entity_id: 'artist-123',
      submitted_by: 'user-1',
      auto_applied: true,
      votable: false,
      votes: { yes: 0, no: 0 },
      created_at: '2026-06-22T00:00:00Z',
    })
  })

  it('prefills the name from route query and redirects to artist detail after submit', async () => {
    const wrapper = mount(CreateArtistView)

    const nameInput = wrapper.get('[data-test="artist-name-input"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('Seed Artist')

    await wrapper.get('[data-test="artist-bio-input"]').setValue('Artist bio')
    await wrapper.get('[data-test="artist-form"]').trigger('submit')
    await flushPromises()

    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({
      type: 'create_artist',
      entity_type: 'artist',
      payload: {
        name: 'Seed Artist',
        bio: 'Artist bio',
      },
      changes: {},
      reason: 'Create artist from wiki flow',
      sources: [],
    })
    expect(mocks.routerPush).toHaveBeenCalledWith('/artist/artist-123')
  })
})
