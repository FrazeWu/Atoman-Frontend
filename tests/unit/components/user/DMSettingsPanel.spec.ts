import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DMSettingsPanel from '@/components/dm/DMSettingsPanel.vue'
import { getDMSettings, updateDMSettings } from '@/api/dm'

vi.mock('@/api/dm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/dm')>()
  return {
    ...actual,
    getDMSettings: vi.fn(),
    updateDMSettings: vi.fn(),
  }
})

describe('DMSettingsPanel', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not expose the default permission before the current setting loads', async () => {
    let resolveSettings!: (value: { permission: 'following_only' }) => void
    vi.mocked(getDMSettings).mockReturnValue(new Promise((resolve) => { resolveSettings = resolve }))
    const wrapper = mount(DMSettingsPanel, { props: { subject: { type: 'user', id: 'user-1' } } })

    expect(wrapper.find('select').exists()).toBe(false)
    resolveSettings({ permission: 'following_only' })
    await flushPromises()

    expect(wrapper.get('select').element).toHaveProperty('value', 'following_only')
  })

  it('offers retry after a failed permission request', async () => {
    vi.mocked(getDMSettings)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ permission: 'anyone' })
    const wrapper = mount(DMSettingsPanel, { props: { subject: { type: 'user', id: 'user-1' } } })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('私信权限加载失败')
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('select').element).toHaveProperty('value', 'anyone')
    expect(updateDMSettings).not.toHaveBeenCalled()
  })
})
