import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import TopbarSearchPopover from '@/components/system/TopbarSearchPopover.vue'

const pushMock = vi.fn()
const searchMock = vi.fn()
const moveActiveMock = vi.fn()
const resetMock = vi.fn()
const sectionsRef = { value: [] as Array<{ type: string; label: string; moreHref: string; items: Array<{ id: string; href: string; title: string }> }> }
const activeItemRef = { value: null as null | { id: string; href: string } }

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('@/composables/useGlobalSearch', () => ({
  useGlobalSearch: () => ({
    loading: { value: false },
    sections: sectionsRef,
    activeItem: activeItemRef,
    moveActive: moveActiveMock,
    search: searchMock,
    reset: resetMock,
  }),
}))

describe('TopbarSearchPopover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    pushMock.mockReset()
    searchMock.mockReset()
    moveActiveMock.mockReset()
    resetMock.mockReset()
    sectionsRef.value = []
    activeItemRef.value = null
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in preview mode and expands into sheet mode on enter', async () => {
    const wrapper = mount(TopbarSearchPopover, {
      props: {
        open: true,
      },
      global: {
        stubs: {
          TopbarSearchSection: true,
        },
      },
    })

    expect(wrapper.find('.topbar-search-popover').classes()).toContain('is-preview')

    window.dispatchEvent(new CustomEvent('atoman-topbar-search-input', { detail: 'atom' }))
    vi.advanceTimersByTime(250)
    await flushPromises()

    window.dispatchEvent(new CustomEvent('atoman-topbar-search-expand'))
    await nextTick()

    expect(wrapper.find('.topbar-search-popover').classes()).toContain('is-expanded')
    expect(wrapper.find('.topbar-search-sheet').exists()).toBe(true)
  })

  it('uses player top edge as expanded sheet bottom limit', async () => {
    const player = document.createElement('div')
    player.className = 'player'
    player.getBoundingClientRect = () => ({
      x: 0, y: 0, width: 1000, height: 84, top: 640, right: 1000, bottom: 724, left: 0,
      toJSON: () => ({}),
    } as DOMRect)
    document.body.appendChild(player)

    const wrapper = mount(TopbarSearchPopover, {
      props: {
        open: true,
      },
      global: {
        stubs: {
          TopbarSearchSection: true,
        },
      },
    })

    window.dispatchEvent(new CustomEvent('atoman-topbar-search-input', { detail: 'atom' }))
    vi.advanceTimersByTime(250)
    await flushPromises()
    window.dispatchEvent(new CustomEvent('atoman-topbar-search-expand'))
    await nextTick()

    const sheet = wrapper.get('.topbar-search-sheet')
    expect(sheet.attributes('style')).toContain('max-height:')
  })

  it('clears local query when popover is closed and reopened', async () => {
    const wrapper = mount(TopbarSearchPopover, {
      props: {
        open: true,
      },
      global: {
        stubs: {
          TopbarSearchSection: true,
        },
      },
    })

    window.dispatchEvent(new CustomEvent('atoman-topbar-search-input', { detail: 'atom' }))
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(searchMock).toHaveBeenCalledWith('atom', 'preview')

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })

    expect(resetMock).toHaveBeenCalled()
  })
})
