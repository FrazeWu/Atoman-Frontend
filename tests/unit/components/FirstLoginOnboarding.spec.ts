import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vi } from 'vitest'

import FirstLoginOnboarding from '@/components/onboarding/FirstLoginOnboarding.vue'
import { modulePathUrl } from '@/router/siteUrls'
import { useOnboardingStore } from '@/stores/onboarding'

const { navigateModuleWithShutter } = vi.hoisted(() => ({
  navigateModuleWithShutter: vi.fn(),
}))

vi.mock('@/composables/useAsyncNavigate', () => ({
  useAsyncNavigate: () => ({
    navigateModuleWithShutter,
  }),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
  ],
})

describe('FirstLoginOnboarding', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await router.push('/')
    navigateModuleWithShutter.mockReset()
    vi.restoreAllMocks()
  })

  it('renders module step with skip action', () => {
    const store = useOnboardingStore()
    store.isVisible = true
    store.currentStep = 'modules'

    const wrapper = mount(FirstLoginOnboarding, {
      global: {
        plugins: [router],
        stubs: {
          PPress: { template: '<button>{{ label }}</button>', props: ['label'] },
        },
      },
    })

    expect(wrapper.text()).toContain('订阅')
    expect(wrapper.text()).toContain('论坛 / 辩论')
    expect(wrapper.text()).toContain('跳过引导')
  })

  it('navigates to explicit feed subscribe handoff from the feed module', async () => {
    const assign = vi.fn()
    const originalLocation = window.location
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          hostname: 'localhost',
          search: '',
          pathname: '/feed',
          assign,
        },
      })

      const store = useOnboardingStore()
      store.isVisible = true
      store.currentStep = 'feed-entry'
      const routerPush = vi.spyOn(router, 'push')

      const wrapper = mount(FirstLoginOnboarding, {
        global: {
          plugins: [router],
          stubs: {
            PPress: {
              template: '<button type="button" @click="$emit(\'click\', $event)">{{ label }}</button>',
              props: ['label'],
              emits: ['click'],
            },
          },
        },
      })

      await wrapper.get('button:last-child').trigger('click')

      expect(store.currentStep).toBe('feed-subscribe')
      expect(assign).not.toHaveBeenCalled()
      expect(routerPush).not.toHaveBeenCalledWith('/')
      expect(navigateModuleWithShutter).toHaveBeenCalledWith(
        `${modulePathUrl('feed', '/')}?onboarding_step=feed-subscribe`,
      )
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })
})
