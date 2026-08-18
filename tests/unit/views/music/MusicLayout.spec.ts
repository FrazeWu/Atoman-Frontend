import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, it, expect, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@/components/system/AppSidebar.vue', () => ({
  default: {
    template: `<nav>
      <div class="sidebar-item" data-to="/music/discover">发现</div>
      <div class="sidebar-item" data-to="/music/albums">专辑</div>
      <div class="sidebar-item" data-to="/music/artists">艺人</div>
      <div class="sidebar-item" data-to="/music/bookmarks">收藏</div>
      <div class="sidebar-item" data-to="/music/history">历史</div>
      <div class="sidebar-item" data-to="/music/imports">导入</div>
    </nav>`,
  },
}))

vi.mock('@/components/music/MusicSheetStack.vue', () => ({
  default: { template: '<div data-testid="music-sheet-stack-stub" />' },
}))
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicLayout from '../../../../src/views/music/MusicLayout.vue'

function mountLayout() {
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  return mount(MusicLayout, {
    global: {
      plugins: [router],
      stubs: {
        'router-view': true,
      },
    },
  })
}

function mountLayoutWithRoute(router: ReturnType<typeof createRouter>) {
  return mount(MusicLayout, {
    global: {
      plugins: [router],
    },
  })
}

describe('MusicLayout.vue', () => {
  it('renders the music navigation items', () => {
    const wrapper = mountLayout()
    const items = wrapper.findAll('.sidebar-item')
    expect(items).toHaveLength(6)
    expect(items[0].text()).toContain('发现')
    expect(items[0].attributes('data-to')).toBe('/music/discover')
    expect(items[1].text()).toContain('专辑')
    expect(items[1].attributes('data-to')).toBe('/music/albums')
    expect(items[2].text()).toContain('艺人')
    expect(items[2].attributes('data-to')).toBe('/music/artists')
    expect(items[3].text()).toContain('收藏')
    expect(items[3].attributes('data-to')).toBe('/music/bookmarks')
    expect(items[4].text()).toContain('历史')
    expect(items[4].attributes('data-to')).toBe('/music/history')
    expect(items[5].text()).toContain('导入')
    expect(items[5].attributes('data-to')).toBe('/music/imports')
  })

  it('marks the music main content area for module-specific scroll behavior', () => {
    const wrapper = mountLayout()
    expect(wrapper.find('main').classes()).toContain('music-main-content')
  })

  it('mounts one semantic music sheet stack', () => {
    const wrapper = mountLayout()
    expect(wrapper.findAll('[data-testid="music-sheet-stack-stub"]')).toHaveLength(1)
  })

  it('preserves a detail route shell after returning from a stacked detail route', async () => {
    let artistMounts = 0
    const ArtistRouteView = defineComponent({
      name: 'MusicArtistRouteView',
      setup() {
        artistMounts += 1
      },
      template: '<div data-testid="artist-detail-route" />',
    })
    const AlbumRouteView = defineComponent({
      name: 'MusicAlbumRouteView',
      template: '<div data-testid="album-detail-route" />',
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/artist/:artistId', component: ArtistRouteView },
        { path: '/album/:albumId', component: AlbumRouteView },
      ],
    })

    await router.push('/artist/artist-1')
    const wrapper = mountLayoutWithRoute(router)
    await nextTick()
    expect(wrapper.find('[data-testid="artist-detail-route"]').exists()).toBe(true)

    await router.push('/album/album-1')
    await nextTick()
    expect(wrapper.find('[data-testid="album-detail-route"]').exists()).toBe(true)

    await router.push('/artist/artist-1')
    await nextTick()
    expect(artistMounts).toBe(1)
    expect(wrapper.find('[data-testid="artist-detail-route"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
