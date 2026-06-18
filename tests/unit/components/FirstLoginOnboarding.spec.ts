import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vi } from 'vitest'

import FirstLoginOnboarding from '@/components/onboarding/FirstLoginOnboarding.vue'
import { useOnboardingStore } from '@/stores/onboarding'

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

  it('does not reload the page when entering feed from the feed module', async () => {
    vi.useFakeTimers()
    const assign = vi.fn()
    const originalLocation = window.location
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          hostname: 'localhost',
          search: '?site=feed',
          assign,
        },
      })

      const store = useOnboardingStore()
      store.isVisible = true
      store.currentStep = 'feed-entry'

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
      await vi.advanceTimersByTimeAsync(600)

      expect(store.currentStep).toBe('feed-subscribe')
      expect(assign).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
      vi.useRealTimers()
    }
  })
})
