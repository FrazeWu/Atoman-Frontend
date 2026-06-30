import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'

import AppTopbar from '@/components/system/AppTopbar.vue'

const makeRouter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/feed', component: { template: '<div />' } },
      { path: '/music', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })

  await router.push('/feed')
  await router.isReady()
  return router
}

const activeNavText = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.nav-link.active').map((link) => link.text())

describe('AppTopbar route reactivity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('updates the active room after SPA navigation changes route path', async () => {
    const router = await makeRouter()
    const wrapper = mount(AppTopbar, {
      global: {
        plugins: [router],
      },
    })

    expect(activeNavText(wrapper)).toEqual(['订阅'])

    await router.push('/music')
    await flushPromises()

    expect(activeNavText(wrapper)).toEqual(['音乐'])
  })
})
