import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'
import { defaultSiteAccess, mergeSiteAccess } from '@/config/siteAccess'
import { moduleNavOrder } from '@/config/moduleRooms'

describe('SettingManagementOverview', () => {
  it('shows only one switch per module', async () => {
    const access = mergeSiteAccess(defaultSiteAccess)
    const wrapper = mount(SettingManagementOverview, {
      props: { access },
    })

    expect(wrapper.text()).toContain('模块开关')
    expect(wrapper.findAll('[data-test^="module-detail-"]')).toHaveLength(0)
    expect(wrapper.findAll('input[data-test^="module-enabled-"]')).toHaveLength(moduleNavOrder.length)
    expect(wrapper.findAll('.setting-management-overview__quick')).toHaveLength(0)
  })

  it('renders a switch for every configured module, including books', () => {
    const access = mergeSiteAccess({ modules: { books: { enabled: true } } })
    const wrapper = mount(SettingManagementOverview, {
      props: { access },
    })

    expect(wrapper.findAll('[data-test="module-list"] > article')).toHaveLength(moduleNavOrder.length)
    expect(wrapper.findAll('input[data-test^="module-enabled-"]')).toHaveLength(moduleNavOrder.length)
    expect((wrapper.get('[data-test="module-enabled-books"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('[data-test="module-detail-books"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="module-detail-video"]').exists()).toBe(false)
  })
})
