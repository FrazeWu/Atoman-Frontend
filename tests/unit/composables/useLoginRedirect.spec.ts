import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { useAuthStore } from '@/stores/auth'

const Harness = defineComponent({
  setup() {
    return useLoginRedirect()
  },
  template: '<button type="button" @click="requireLogin">继续</button>',
})

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
}

describe('useLoginRedirect', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('redirects guests to login with the current route', async () => {
    const router = createTestRouter()
    await router.push('/music/album/album-1?tab=history')
    const wrapper = mount(Harness, { global: { plugins: [router] } })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/music/album/album-1?tab=history')
  })

  it('does not navigate when the user is authenticated', async () => {
    const router = createTestRouter()
    await router.push('/music/artist/artist-1')
    useAuthStore().isAuthenticated = true
    const wrapper = mount(Harness, { global: { plugins: [router] } })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/music/artist/artist-1')
  })
})
