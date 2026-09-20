import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicTagsView from '../../../../src/views/music/MusicTagsView.vue'

const mocks = vi.hoisted(() => ({
  listMusicTagOptions: vi.fn(),
  getMusicTag: vi.fn(),
  createMusicTag: vi.fn(),
}))

const loginMocks = vi.hoisted(() => ({
  isAuthenticated: { value: true },
  requireLogin: vi.fn(() => true),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicTagOptions: mocks.listMusicTagOptions,
  getMusicTag: mocks.getMusicTag,
  createMusicTag: mocks.createMusicTag,
}))

vi.mock('@/composables/useLoginRedirect', () => ({
  useLoginRedirect: () => loginMocks,
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
      plugins: [router, createPinia()],
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
    mocks.listMusicTagOptions.mockReset()
    mocks.getMusicTag.mockReset()
    mocks.createMusicTag.mockReset()
    loginMocks.requireLogin.mockClear()
    mocks.listMusicTagOptions.mockImplementation(async (filters: { kind?: string; query?: string }) => {
      if (filters.query) {
        if (filters.kind === 'scene') return []
        return filters.kind === 'type'
          ? [{ id: 'tag-type', name: '民谣', kind: 'type', depth: 1, assignment_count: 2, child_count: 0 }]
          : [{ id: 'tag-mood', name: '治愈', kind: 'mood', depth: 1, assignment_count: 3, child_count: 0 }]
      }
      return filters.kind === 'type'
        ? [{ id: 'tag-type-root', name: '电子', kind: 'type', depth: 1, assignment_count: 2, child_count: 1 }]
        : []
    })
    mocks.getMusicTag.mockResolvedValue({ id: 'tag-type-root', name: '电子', kind: 'type', depth: 1, child_count: 1 })
    mocks.createMusicTag.mockResolvedValue({ id: 'tag-new', name: '夜晚', kind: 'scene', depth: 1, child_count: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the hierarchy and guides users to search before loading results', async () => {
    const { wrapper } = await mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="music-tags-view"]').text()).toContain('一级维度')
    expect(wrapper.get('[data-testid="music-tag-scope-mood"]').text()).toContain('情绪')
    expect(wrapper.text()).toContain('电子')
    expect(mocks.listMusicTagOptions).toHaveBeenCalled()
  })

  it('searches both kinds and renders clickable tag results', async () => {
    const { wrapper, router } = await mountView({ q: '治' })
    await flushPromises()

    expect(mocks.listMusicTagOptions).toHaveBeenCalledWith({ kind: undefined, query: '治' })
    expect(wrapper.get('[data-testid="music-tag-results"]').text()).toContain('治愈')
    expect(wrapper.get('[data-testid="music-tag-result-tag-mood"]').attributes('href')).toContain('/music/tags/tag-mood')

    await wrapper.get('[data-testid="music-tag-scope-type"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.kind).toBe('type')
    expect(mocks.listMusicTagOptions).toHaveBeenLastCalledWith({ kind: 'type', query: '治' })
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

  it('creates a missing tag inside the selected dimension', async () => {
    const { wrapper, router } = await mountView({ kind: 'scene', q: '夜晚' })
    await flushPromises()

    await wrapper.get('[data-testid="music-tag-create"]').trigger('click')
    await flushPromises()

    expect(mocks.createMusicTag).toHaveBeenCalledWith({ kind: 'scene', name: '夜晚', parent_id: undefined })
    expect(router.currentRoute.value.path).toBe('/music/tags/tag-new')
  })
})
