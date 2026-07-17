import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { asyncRouteView } from '@/router/asyncRouteView'

describe('asyncRouteView', () => {
  it('returns a component object that Vue Router does not treat as a route loader', () => {
    const AsyncPage = asyncRouteView(() => Promise.resolve(defineComponent({ template: '<div />' })))

    expect(typeof AsyncPage).toBe('object')
  })

  it('shows a loading state until the page component resolves', async () => {
    let resolvePage!: (component: ReturnType<typeof defineComponent>) => void
    const pagePromise = new Promise<ReturnType<typeof defineComponent>>((resolve) => {
      resolvePage = resolve
    })
    const AsyncPage = asyncRouteView(() => pagePromise)
    const Host = defineComponent({ components: { AsyncPage }, template: '<main><AsyncPage /></main>' })
    const wrapper = mount(Host)

    expect(wrapper.text()).toContain('正在加载')

    resolvePage(defineComponent({ template: '<section>页面内容</section>' }))
    await flushPromises()

    expect(wrapper.text()).toContain('页面内容')
    expect(wrapper.text()).not.toContain('正在加载')
  })
})
