import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExploreView from '@/views/music/ExploreView.vue'

const mocks = vi.hoisted(() => ({
  listRecommendedAlbums: vi.fn(),
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listRecommendedAlbums: mocks.listRecommendedAlbums,
  listMusicAlbums: mocks.listMusicAlbums,
  listMusicArtists: mocks.listMusicArtists,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
  RouterLink: {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
  },
}))

describe('Music ExploreView.vue', () => {
  beforeEach(() => {
    mocks.listRecommendedAlbums.mockReset()
    mocks.listMusicAlbums.mockReset()
    mocks.listMusicArtists.mockReset()
    mocks.push.mockReset()

    mocks.listRecommendedAlbums.mockResolvedValue({
      data: [
        { id: 'rec-1', title: 'Recommended Album', summary: 'summary', target_path: '/music?album=rec-1', image_url: '' },
      ],
    })
    mocks.listMusicAlbums.mockResolvedValue({
      data: [
        { id: 'album-1', title: '2049', artists: [{ id: 'artist-1', name: 'Ye' }] },
      ],
      meta: { page: 1, page_size: 4, total: 1, has_more: false },
    })
    mocks.listMusicArtists.mockResolvedValue({
      data: [
        { id: 'artist-1', name: 'Ye', legal_name: 'Kanye' },
      ],
      meta: { page: 1, page_size: 4, total: 1, has_more: false },
    })
  })

  it('shows album and artist groups in search dropdown', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PTab: { props: ['label'], template: '<button><slot>{{ label }}</slot></button>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    const input = wrapper.find('[data-testid="music-explore-search-input"]')
    await input.trigger('focus')
    await input.setValue('ye')
    await flushPromises()

    expect(mocks.listMusicAlbums).toHaveBeenLastCalledWith({ q: 'ye', page: 1, page_size: 4, sort: 'hot' })
    expect(mocks.listMusicArtists).toHaveBeenLastCalledWith({ q: 'ye', page: 1, page_size: 4 })
    expect(wrapper.text()).toContain('专辑')
    expect(wrapper.text()).toContain('艺术家')
    expect(wrapper.text()).toContain('2049')
    expect(wrapper.text()).toContain('Ye')

    const resultButtons = wrapper.findAll('button.search-result')
    await resultButtons[0].trigger('mousedown')
    expect(mocks.push).toHaveBeenCalledWith('/music?album=album-1')

    await input.trigger('focus')
    await input.setValue('ye')
    await flushPromises()
    const reopenedButtons = wrapper.findAll('button.search-result')
    await reopenedButtons[1].trigger('mousedown')
    expect(mocks.push).toHaveBeenCalledWith('/music?artist=artist-1')
  })
})
