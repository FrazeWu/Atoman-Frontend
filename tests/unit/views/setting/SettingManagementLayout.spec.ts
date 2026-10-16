import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import SettingManagementLayout from '@/views/setting/SettingManagementLayout.vue'

const routerMocks = vi.hoisted(() => ({
  route: { path: '/site/setting', hash: '', query: {} },
  replace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterView: defineComponent({ template: '<div data-test="router-view" />' }),
  useRoute: () => routerMocks.route,
  useRouter: () => routerMocks,
}))

const PDirectoryNavStub = defineComponent({
  props: ['items'],
  emits: ['select'],
  template: '<nav data-test="directory"><button v-for="item in items" :key="item.id" @click="$emit(\'select\', item.id)">{{ item.label }}</button></nav>',
})

describe('SettingManagementLayout', () => {
  it('restores the page directory and points entries at in-page sections', async () => {
    const wrapper = mount(SettingManagementLayout, {
      global: {
        stubs: {
          PButton: defineComponent({ template: '<button><slot /></button>' }),
          PDirectoryNav: PDirectoryNavStub,
        },
      },
    })

    expect(wrapper.find('.setting-management-layout__shell').element.children[0]).toBe(wrapper.get('[data-test="directory"]').element)

    expect(wrapper.findAll('[data-test="directory"] button').map((button) => button.text())).toEqual([
      '模块开关',
      '用户管理',
      '社区管理',
      '公告管理',
      '模块管理',
    ])

    await wrapper.findAll('[data-test="directory"] button')[1]?.trigger('click')
    expect(routerMocks.replace).toHaveBeenCalledWith({
      path: '/site/setting',
      query: {},
      hash: '#users',
    })
  })

  it('exposes the standard page header and integrates the mobile directory trigger', async () => {
    const wrapper = mount(SettingManagementLayout, {
      global: {
        stubs: {
          PButton: defineComponent({ template: '<button class="p-button-stub"><slot /></button>' }),
          PDirectoryNav: PDirectoryNavStub,
        },
      },
    })

    expect(wrapper.find('.p-page-header').exists()).toBe(true)
    expect(wrapper.get('.p-page-header__title').text()).toBe('站点设置')
    expect(wrapper.get('.p-page-header__sub').text()).toBe('管理平台访问权限、用户角色、社区与模块配置')
    expect(wrapper.find('.setting-management-layout__directory-trigger').exists()).toBe(true)
  })
})
