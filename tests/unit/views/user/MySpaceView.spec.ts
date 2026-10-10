import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import MySpaceView from '@/views/user/MySpaceView.vue'
import { useAuthStore } from '@/stores/auth'

const WorkspaceStub = defineComponent({ template: '<section data-testid="workspace-panel">工作台内容</section>' })
const ProfileStub = defineComponent({
  props: ['handle', 'embedded'],
  template: '<section data-testid="profile-panel">公开主页：{{ handle }}，嵌入：{{ embedded }}</section>',
})

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/me', component: MySpaceView }],
  })
}

describe('MySpaceView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = { uuid: 'user-1', username: 'alice', email: 'alice@example.com', display_name: 'Alice' }
    auth.token = 'token'
    auth.isAuthenticated = true
  })

  async function mountView(path = '/me') {
    const router = makeRouter()
    await router.push(path)
    await router.isReady()
    const wrapper = mount(MySpaceView, {
      global: {
        plugins: [router],
        stubs: {
          MyHubView: WorkspaceStub,
          ProfileView: ProfileStub,
        },
      },
    })
    await flushPromises()
    return { wrapper, router }
  }

  it('defaults to the workspace and exposes the public profile tab', async () => {
    const { wrapper, router } = await mountView()

    expect(wrapper.get('[data-testid="my-space-tab-workspace"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="workspace-panel"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="my-space-tab-profile"]').attributes('href')).toContain('/me?view=profile')
    expect(wrapper.find('[data-testid="profile-panel"]').exists()).toBe(false)
    expect(router.currentRoute.value.query.view).toBeUndefined()
  })

  it('restores the public profile view from the URL query', async () => {
    const { wrapper, router } = await mountView('/me?view=profile')

    expect(wrapper.get('[data-testid="my-space-tab-profile"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="profile-panel"]').text()).toContain('公开主页：alice')
    expect(wrapper.find('[data-testid="workspace-panel"]').exists()).toBe(false)
    expect(router.currentRoute.value.query.view).toBe('profile')
  })

  it('normalizes an invalid view query to the workspace', async () => {
    const { wrapper, router } = await mountView('/me?view=unknown')

    await flushPromises()
    expect(wrapper.get('[data-testid="workspace-panel"]').exists()).toBe(true)
    expect(router.currentRoute.value.query.view).toBeUndefined()
  })
})
