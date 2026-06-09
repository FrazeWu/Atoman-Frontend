import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import ABtn from '@/components/ui/ABtn.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/post/new', component: { template: '<div />' } }],
})

describe('ABtn', () => {
  it('renders label and emits click', async () => {
    const wrapper = mount(ABtn, {
      props: {
        label: '提交',
      },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('prevents click when loading', async () => {
    const wrapper = mount(ABtn, {
      props: {
        label: '发布',
        loading: true,
        loadingText: '发布中...',
      },
    })

    expect(wrapper.get('button').text()).toContain('发布中...')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('click')).toBeFalsy()
  })

  it('renders router links for navigation actions', () => {
    const wrapper = mount(ABtn, {
      global: { plugins: [router] },
      props: {
        to: '/post/new',
        label: '写文章',
      },
    })

    expect(wrapper.text()).toContain('写文章')
    expect(wrapper.findComponent({ name: 'RouterLink' }).exists()).toBe(true)
  })
})
