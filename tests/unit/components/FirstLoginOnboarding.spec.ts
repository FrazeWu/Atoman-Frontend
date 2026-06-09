import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

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
  })

  it('renders module step with skip action', () => {
    const store = useOnboardingStore()
    store.isVisible = true
    store.currentStep = 'modules'

    const wrapper = mount(FirstLoginOnboarding, {
      global: {
        plugins: [router],
        stubs: {
          PaperPress: { template: '<button>{{ label }}</button>', props: ['label'] },
        },
      },
    })

    expect(wrapper.text()).toContain('订阅')
    expect(wrapper.text()).toContain('论坛 / 辩论')
    expect(wrapper.text()).toContain('跳过引导')
  })
})
