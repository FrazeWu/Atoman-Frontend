import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import PBookmarkTab from '@/components/ui/PBookmarkTab.vue'
import PClip from '@/components/ui/PClip.vue'
import PLink from '@/components/ui/PLink.vue'
import PPress from '@/components/ui/PPress.vue'
import PReject from '@/components/ui/PReject.vue'
import PTab from '@/components/ui/PTab.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/target', component: { template: '<div />' } }],
})

describe('P action components', () => {
  it('emits PTab click and exposes pressed state when active', async () => {
    const wrapper = mount(PTab, { props: { label: 'Featured', active: true } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  })

  it('does not emit PClip click when disabled', async () => {
    const wrapper = mount(PClip, { props: { label: 'Clip', disabled: true } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('does not emit PPress click while loading', async () => {
    const wrapper = mount(PPress, {
      props: { label: 'Publish', loading: true, loadingText: 'Publishing' },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('button').text()).toContain('Publishing')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('renders PLink as a router link with an index arrow', () => {
    const wrapper = mount(PLink, {
      global: { plugins: [router] },
      props: { to: '/target', label: 'View Channel' },
    })

    expect(wrapper.text()).toContain('View Channel')
    expect(wrapper.text()).toContain('→')
    expect(wrapper.findComponent({ name: 'RouterLink' }).exists()).toBe(true)
  })

  it('renders PReject as a destructive action and still emits click', async () => {
    const wrapper = mount(PReject, { props: { label: 'Reject' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.get('button').text()).toContain('Reject')
  })

  it('separates PBookmarkTab close and select actions', async () => {
    const wrapper = mount(PBookmarkTab, { props: { label: '文章详情', active: true } })

    await wrapper.get('.p-bookmark-tab__label').trigger('click')
    await wrapper.get('.p-bookmark-tab__close').trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.get('.p-bookmark-tab__label').attributes('aria-current')).toBe('page')
  })
})
