import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import AppTopbar from '@/components/system/AppTopbar.vue'

vi.mock('@/api/references', () => ({ referenceApi: { search: vi.fn().mockResolvedValue([]) } }))
vi.mock('vue-router', async importOriginal => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRoute: () => ({ path: '/feed', fullPath: '/feed', matched: [] }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

describe('topbar initial search availability', () => {
  it('opens search immediately after mounting without waiting for idle timers', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AppTopbar, {
      global: {
        plugins: [createPinia()],
        stubs: { RouterLink: true, MobileModuleSwitcher: true, AppTopbarAuthControls: true },
      },
    })

    try {
      await flushPromises()
      const trigger = wrapper.find('[data-testid="topbar-search-pill"]')
      expect(trigger.exists()).toBe(true)
      await trigger.trigger('click')
      expect(wrapper.find('[data-testid="topbar-search-dropdown"]').exists()).toBe(true)
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })
})
