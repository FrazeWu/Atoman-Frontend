import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import PSidebar from '@/components/ui/PSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'

const SidebarHarness = defineComponent({
  components: { PSidebar },
  setup() {
    const collapsed = ref(false)
    return { collapsed }
  },
  template: '<PSidebar v-model:collapsed="collapsed" />',
})

describe('PSidebar collapsed state compatibility', () => {
  const { sidebarCollapsed, toggleSidebar } = useSidebar()

  beforeEach(() => {
    localStorage.clear()
    sidebarCollapsed.value = false
  })

  it('syncs global sidebar changes to legacy v-model layouts', async () => {
    const wrapper = mount(SidebarHarness)

    toggleSidebar()
    await nextTick()

    expect(wrapper.vm.collapsed).toBe(true)
  })

  it('syncs legacy v-model changes back to global sidebar state', async () => {
    const wrapper = mount(SidebarHarness)
    toggleSidebar()
    await nextTick()

    wrapper.vm.collapsed = false
    await nextTick()

    expect(sidebarCollapsed.value).toBe(false)
    expect(localStorage.getItem('atoman.global.sidebar.collapsed')).toBe('false')
  })
})
