import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listPublicationReports, reviewPublicationReport } from '@/api/books'
import SettingBookReportsPanel from '@/components/setting/SettingBookReportsPanel.vue'

vi.mock('@/api/books', () => ({
  listPublicationReports: vi.fn(),
  reviewPublicationReport: vi.fn(),
}))

const report = {
  id: 'report-1',
  asset_id: 'asset-1',
  reason: 'copyright\n不是公有领域',
  status: 'pending',
  created_at: '2026-08-27T00:00:00Z',
}

describe('SettingBookReportsPanel', () => {
  beforeEach(() => {
    vi.mocked(listPublicationReports).mockReset()
    vi.mocked(reviewPublicationReport).mockReset()
  })

  it('列出待处理举报并下架对应公共电子书', async () => {
    vi.mocked(listPublicationReports).mockResolvedValue({ items: [report], total: 1, limit: 20, offset: 0 })
    vi.mocked(reviewPublicationReport).mockResolvedValue({ ...report, status: 'removed' })
    const wrapper = mount(SettingBookReportsPanel, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()

    expect(listPublicationReports).toHaveBeenCalledWith({ limit: 20, offset: 0 })
    expect(wrapper.text()).toContain('版权或权利问题')
    expect(wrapper.text()).toContain('不是公有领域')
    expect(wrapper.text()).toContain('asset-1')

    const remove = wrapper.findAll('button').find(button => button.text() === '下架')
    expect(remove).toBeTruthy()
    await remove!.trigger('click')
    await flushPromises()

    expect(reviewPublicationReport).toHaveBeenCalledWith('report-1', { decision: 'removed', note: '下架公共电子书' })
    expect(wrapper.text()).toContain('暂无待处理的书籍举报')
  })
})
