import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'
import { defaultSiteAccess, mergeSiteAccess } from '@/config/siteAccess'

describe('SettingManagementOverview', () => {
  it('shows the prototype module list with one switch per module', async () => {
    const access = mergeSiteAccess(defaultSiteAccess)
    const openDetail = vi.fn()
    const wrapper = mount(SettingManagementOverview, {
      props: { access, onOpenDetail: openDetail },
    })

    expect(wrapper.text()).toContain('模块可用性')
    expect(wrapper.findAll('[data-test^="module-detail-"]')).toHaveLength(6)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(8)

    await wrapper.get('[data-test="module-detail-music"]').trigger('click')
    expect(openDetail).toHaveBeenCalledWith('music')
  })

  it('updates quick settings on the shared access object', async () => {
    const access = mergeSiteAccess(defaultSiteAccess)
    const wrapper = mount(SettingManagementOverview, { props: { access } })

    await wrapper.get('[aria-label="订阅全文抓取策略"]').setValue('disabled')
    await wrapper.get('[aria-label="博客评论权限"]').setValue('all')

    expect(access.settings.feed.full_text_mode).toBe('disabled')
    expect(access.settings.blog.comment_mode).toBe('all')
  })
})
