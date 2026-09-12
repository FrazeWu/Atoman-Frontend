import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicTagsView from '../../../../src/views/music/MusicTagsView.vue'

const mocks = vi.hoisted(() => ({
  searchMusicTags: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  searchMusicTags: mocks.searchMusicTags,
}))

async function mountView(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/music/tags', component: MusicTagsView },
      { path: '/music/tags/:tagId', component: { template: '<div />' } },
    ],
  })
  await router.push({ path: '/music/tags', query })
  await router.isReady()
  const wrapper = mount(MusicTagsView, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
        },
      },
    },
  })
  return { router, wrapper }
}

describe('MusicTagsView.vue', () => {
  beforeEach(() => {
    mocks.searchMusicTags.mockReset()
    mocks.searchMusicTags.mockImplementation(async (kind: string) => kind === 'mood'
      ? [{ id: 'tag-mood', name: '治愈', kind: 'mood' }]
      : [{ id: 'tag-type', name: '民谣', kind: 'type' }])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the hierarchy and guides users to search before loading results', async () => {
    const { wrapper } = await mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="music-tags-view"]').text()).toContain('一级分类')
    expect(wrapper.get('[data-testid="music-tag-scope-mood"]').text()).toContain('情绪')
    expect(wrapper.text()).toContain('输入关键词开始搜索')
    expect(mocks.searchMusicTags).not.toHaveBeenCalled()
  })

  it('searches both kinds and renders clickable tag results', async () => {
    const { wrapper, router } = await mountView({ q: '治' })
    await flushPromises()

    expect(mocks.searchMusicTags).toHaveBeenCalledWith('mood', '治')
    expect(mocks.searchMusicTags).toHaveBeenCalledWith('type', '治')
    expect(wrapper.get('[data-testid="music-tag-results"]').text()).toContain('治愈')
    expect(wrapper.get('[data-testid="music-tag-result-tag-mood"]').attributes('href')).toContain('/music/tags/tag-mood')

    await wrapper.get('[data-testid="music-tag-scope-type"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.kind).toBe('type')
    expect(mocks.searchMusicTags).toHaveBeenLastCalledWith('type', '治')
  })

  it('keeps the search text in the URL when it changes', async () => {
    vi.useFakeTimers()
    const { wrapper, router } = await mountView()
    const input = wrapper.get('input[type="search"]')

    await input.setValue('夜晚')
    vi.advanceTimersByTime(220)
    await flushPromises()

    expect(router.currentRoute.value.query.q).toBe('夜晚')
    vi.useRealTimers()
  })
})
