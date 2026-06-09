import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import PaperBookmarkTab from '@/components/ui/PaperBookmarkTab.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperLink from '@/components/ui/PaperLink.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import PaperTab from '@/components/ui/PaperTab.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/target', component: { template: '<div />' } }],
})

describe('Paper Actions', () => {
  it('emits PaperTab click and exposes pressed state when active', async () => {
    const wrapper = mount(PaperTab, { props: { label: 'Featured', active: true } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  })

  it('does not emit PaperClip click when disabled', async () => {
    const wrapper = mount(PaperClip, { props: { label: 'Clip', disabled: true } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('does not emit PaperPress click while loading', async () => {
    const wrapper = mount(PaperPress, {
      props: { label: 'Publish', loading: true, loadingText: 'Publishing' },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('button').text()).toContain('Publishing')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('renders PaperLink as a router link with an index arrow', () => {
    const wrapper = mount(PaperLink, {
      global: { plugins: [router] },
      props: { to: '/target', label: 'View Channel' },
    })

    expect(wrapper.text()).toContain('View Channel')
    expect(wrapper.text()).toContain('→')
    expect(wrapper.findComponent({ name: 'RouterLink' }).exists()).toBe(true)
  })

  it('renders PaperReject as a destructive action and still emits click', async () => {
    const wrapper = mount(PaperReject, { props: { label: 'Reject' } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(wrapper.get('button').text()).toContain('Reject')
  })

  it('separates PaperBookmarkTab close and select actions', async () => {
    const wrapper = mount(PaperBookmarkTab, { props: { label: '文章详情', active: true } })

    await wrapper.get('.paper-bookmark-tab__label').trigger('click')
    await wrapper.get('.paper-bookmark-tab__close').trigger('click')

    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.get('.paper-bookmark-tab__label').attributes('aria-current')).toBe('page')
  })
})
