import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileBottomNav from '@/components/system/MobileBottomNav.vue'
import { getMobileMoreItems, getMobilePrimaryTabs } from '@/composables/useResponsiveShell'
import { modulePathUrl, moduleUrl } from '@/composables/useSubdomainNav'

const { navigateModuleWithShutter } = vi.hoisted(() => ({
  navigateModuleWithShutter: vi.fn(),
}))

vi.mock('@/composables/useAsyncNavigate', () => ({
  useAsyncNavigate: () => ({
    navigateModuleWithShutter,
  }),
}))

describe('useResponsiveShell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    navigateModuleWithShutter.mockReset()
  })

  it('returns four fixed primary mobile tabs', () => {
    const tabs = getMobilePrimaryTabs()

    expect(tabs.map((tab) => tab.key)).toEqual(['discover', 'feed', 'create', 'more'])
    expect(tabs.map((tab) => tab.label)).toEqual(['首页/播客', '订阅', '创作/播客', '更多'])
    expect(tabs[0]?.href).toBe(moduleUrl('media'))
    expect(tabs[1]?.href).toBe(moduleUrl('feed'))
    expect(tabs[2]?.href).toBe(modulePathUrl('media', '/create'))
    expect(tabs[3]?.href).toBeUndefined()
  })

  it('moves low-frequency modules into the more sheet', () => {
    const items = getMobileMoreItems()

    expect(items.map((item) => item.module)).toContain('forum')
    expect(items.map((item) => item.module)).toContain('timeline')
    expect(items.map((item) => item.module)).not.toContain('feed')
  })

  it('returns defensive copies for tab and more-sheet collections', () => {
    const firstTabs = getMobilePrimaryTabs()
    const secondTabs = getMobilePrimaryTabs()
    const firstMoreItems = getMobileMoreItems()
    const secondMoreItems = getMobileMoreItems()

    expect(firstTabs).not.toBe(secondTabs)
    expect(firstTabs[0]).not.toBe(secondTabs[0])
    expect(firstMoreItems).not.toBe(secondMoreItems)
    expect(firstMoreItems[0]).not.toBe(secondMoreItems[0])

    firstTabs[0]!.label = 'changed'
    firstMoreItems[0]!.label = 'changed'

    expect(secondTabs[0]?.label).toBe('首页/播客')
    expect(secondMoreItems[0]?.label).toBe('音乐')
  })

  it('renders four primary tabs and marks the active module route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
      ],
    })

    await router.push('/')
    await router.isReady()

    const wrapper = mount(MobileBottomNav, {
      global: {
        plugins: [router],
      },
    })

    const tabs = wrapper.findAll('[data-testid="mobile-bottom-nav-tab"]')

    expect(tabs).toHaveLength(4)
    expect(tabs.map((tab) => tab.text())).toEqual(['首页/播客', '订阅', '创作/播客', '更多'])
    expect(wrapper.get('[data-tab-key="feed"]').classes()).toContain('is-active')
  })

  it('opens and closes the more sheet from the more tab', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
      ],
    })

    await router.push('/')
    await router.isReady()

    const wrapper = mount(MobileBottomNav, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.find('[data-testid="mobile-more-sheet"]').exists()).toBe(false)

    await wrapper.get('[data-tab-key="more"]').trigger('click')

    expect(wrapper.get('[data-testid="mobile-more-sheet"]').text()).toContain('论坛')
    expect(wrapper.get('[data-testid="mobile-more-sheet"]').text()).toContain('时间线')
    expect(wrapper.findAll('.header-close-btn')).toHaveLength(1)
    expect(wrapper.find('[data-testid="mobile-more-sheet-close"]').exists()).toBe(false)

    await wrapper.get('.header-close-btn').trigger('click')

    expect(wrapper.find('[data-testid="mobile-more-sheet"]').exists()).toBe(false)
  })

  it('uses shutter navigation for the create tab target', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
      ],
    })

    await router.push('/')
    await router.isReady()

    const wrapper = mount(MobileBottomNav, {
      global: {
        plugins: [router],
      },
    })

    await wrapper.get('[data-tab-key="create"]').trigger('click')

    expect(navigateModuleWithShutter).toHaveBeenCalledTimes(1)
    expect(navigateModuleWithShutter).toHaveBeenCalledWith(modulePathUrl('media', '/create'))
  })
})
