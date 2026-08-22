import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import AppTopbar from '@/components/system/AppTopbar.vue'
import { useAuthStore } from '@/stores/auth'

describe('AppTopbar session restoration', () => {
  it('keeps global search available when no session is restored', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    vi.spyOn(authStore, 'restoreSession').mockResolvedValue(false)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/feed', component: { template: '<div />' } },
        { path: '/login', component: { template: '<div />' } },
      ],
    })

    await router.push('/feed')
    await router.isReady()
    const wrapper = mount(AppTopbar, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="topbar-search-pill"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/login"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('switches to authenticated controls after restoring a session on a public route', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    const restoreSession = vi.spyOn(authStore, 'restoreSession').mockImplementation(async () => {
      authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' }
      authStore.isAuthenticated = true
      return true
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/feed', component: { template: '<div />' } },
        { path: '/login', component: { template: '<div />' } },
      ],
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { total: 0, items: {} } }))))

    await router.push('/feed')
    await router.isReady()
    const wrapper = mount(AppTopbar, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(restoreSession).toHaveBeenCalledOnce()
    expect(wrapper.find('.user-btn').text()).toContain('alice')
    expect(wrapper.find('[data-test="topbar-add-subscription"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not restore a session when mounted on an auth layout route', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    const restoreSession = vi.spyOn(authStore, 'restoreSession').mockResolvedValue(false)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: { template: '<div />' }, meta: { authLayout: true } }],
    })

    await router.push('/login')
    await router.isReady()
    const wrapper = mount(AppTopbar, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(restoreSession).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('restores a session after navigating from an auth layout route to a public route', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    const restoreSession = vi.spyOn(authStore, 'restoreSession').mockImplementation(async () => {
      authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' }
      authStore.isAuthenticated = true
      return true
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: { template: '<div />' }, meta: { authLayout: true } },
        { path: '/feed', component: { template: '<div />' } },
      ],
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { total: 0, items: {} } }))))

    await router.push('/login')
    await router.isReady()
    const wrapper = mount(AppTopbar, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(restoreSession).not.toHaveBeenCalled()

    await router.push('/feed')
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(restoreSession).toHaveBeenCalledOnce()
    expect(wrapper.find('.user-btn').text()).toContain('alice')
    wrapper.unmount()
  })
})
