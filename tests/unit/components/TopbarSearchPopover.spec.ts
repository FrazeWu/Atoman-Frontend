import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TopbarSearchPopover from '@/components/system/TopbarSearchPopover.vue'

const pushMock = vi.fn()
const searchMock = vi.fn()
const moveActiveMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('@/composables/useGlobalSearch', () => ({
  useGlobalSearch: () => ({
    loading: { value: false },
    sections: { value: [] },
    activeItem: { value: null },
    moveActive: moveActiveMock,
    search: searchMock,
    reset: vi.fn(),
  }),
}))

describe('TopbarSearchPopover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    pushMock.mockReset()
    searchMock.mockReset()
    moveActiveMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
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

    const input = wrapper.get('input')
    await input.setValue('atom')
    vi.advanceTimersByTime(250)
    await flushPromises()
    expect(searchMock).toHaveBeenCalledWith('atom')

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  })
})
