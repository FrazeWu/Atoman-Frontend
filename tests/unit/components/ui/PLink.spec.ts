import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import PLink from '@/components/ui/PLink.vue'
import { useSafeLink } from '@/composables/useSafeLink'

describe('PLink', () => {
  const { safeLinkState, closeSafeLink } = useSafeLink()

  const createTestRouter = () => createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/:catchAll(.*)', component: { template: '<div />' } },
    ],
  })

  beforeEach(() => {
    closeSafeLink()
    vi.restoreAllMocks()
  })

  it('renders internal link with RouterLink and passes through without interception', async () => {
    const router = createTestRouter()
    const wrapper = mount(PLink, {
      props: {
        to: '/dashboard',
        label: '控制台',
      },
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.text()).toContain('控制台')
    expect(wrapper.text()).toContain('→')
    expect(wrapper.findComponent({ name: 'RouterLink' }).exists()).toBe(true)

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(safeLinkState.value.isOpen).toBe(false)
  })

  it('renders internal relative href without interception', async () => {
    const router = createTestRouter()
    const wrapper = mount(PLink, {
      props: {
        href: '/blog/posts',
        label: '博客',
      },
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.text()).toContain('博客')
    expect(wrapper.text()).toContain('→')
    expect(wrapper.findComponent({ name: 'RouterLink' }).exists()).toBe(true)

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(safeLinkState.value.isOpen).toBe(false)
  })

  it('renders anchor fragment href without interception', async () => {
    const router = createTestRouter()
    const wrapper = mount(PLink, {
      props: {
        href: '#overview',
        label: '概览',
      },
      global: {
        plugins: [router],
      },
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(safeLinkState.value.isOpen).toBe(false)
  })

  it('intercepts external link clicks and triggers safeLinkModal', async () => {
    const wrapper = mount(PLink, {
      props: {
        href: 'https://github.com/atoman',
        label: 'GitHub',
      },
    })

    expect(wrapper.text()).toContain('GitHub')
    expect(wrapper.text()).toContain('↗')
    expect(wrapper.element.tagName.toLowerCase()).toBe('a')
    expect(wrapper.attributes('target')).toBe('_blank')
    expect(wrapper.attributes('rel')).toContain('noopener')
    expect(wrapper.attributes('rel')).toContain('noreferrer')

    const event = new MouseEvent('click', { cancelable: true, bubbles: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    wrapper.element.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(safeLinkState.value.isOpen).toBe(true)
    expect(safeLinkState.value.targetUrl).toBe('https://github.com/atoman')
    expect(safeLinkState.value.targetHostname).toBe('github.com')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('honors explicit external prop even with domain link', async () => {
    const wrapper = mount(PLink, {
      props: {
        href: 'https://developer.mozilla.org',
        external: true,
        label: 'MDN',
      },
    })

    await wrapper.trigger('click')
    expect(safeLinkState.value.isOpen).toBe(true)
    expect(safeLinkState.value.targetUrl).toBe('https://developer.mozilla.org')
    expect(safeLinkState.value.targetHostname).toBe('developer.mozilla.org')
  })

  it('does not open safe link for unsafe javascript scheme', async () => {
    const wrapper = mount(PLink, {
      props: {
        href: 'javascript:alert(1)',
        external: true,
        label: 'Unsafe',
      },
    })

    await wrapper.trigger('click')
    expect(safeLinkState.value.isOpen).toBe(false)
  })
})
