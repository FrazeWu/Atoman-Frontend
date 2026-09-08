import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'
import { defaultSiteAccess, mergeSiteAccess } from '@/config/siteAccess'
import { moduleNavOrder } from '@/config/moduleRooms'

describe('SettingManagementOverview', () => {
  it('shows the module list and opens every module management anchor', async () => {
    const access = mergeSiteAccess(defaultSiteAccess)
    const openDetail = vi.fn()
    const wrapper = mount(SettingManagementOverview, {
      props: { access, onOpenDetail: openDetail },
    })

    expect(wrapper.text()).toContain('模块可用性')
    expect(wrapper.findAll('[data-test^="module-detail-"]')).toHaveLength(moduleNavOrder.length)
    expect(wrapper.findAll('input[data-test^="module-enabled-"]')).toHaveLength(moduleNavOrder.length)

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

  it('renders a switch for every configured module, including books', () => {
    const access = mergeSiteAccess({ modules: { books: { enabled: true } } })
    const wrapper = mount(SettingManagementOverview, {
      props: { access },
    })

    expect(wrapper.findAll('[data-test="module-list"] > article')).toHaveLength(moduleNavOrder.length)
    expect(wrapper.findAll('input[data-test^="module-enabled-"]')).toHaveLength(moduleNavOrder.length)
    expect((wrapper.get('[data-test="module-enabled-books"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('[data-test="module-detail-books"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="module-detail-video"]').exists()).toBe(true)
  })

  it('keeps module feature switches visible beside module quick settings', () => {
    const access = mergeSiteAccess(null)
    const wrapper = mount(SettingManagementOverview, { props: { access } })

    expect(wrapper.get('[data-test="module-enabled-feed"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="module-enabled-blog"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="module-enabled-forum"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="feature-subscription.manage"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="feature-post.create"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="feature-topic.create"]').exists()).toBe(true)
  })
})
