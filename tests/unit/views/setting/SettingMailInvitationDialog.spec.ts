import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import SettingMailInvitationDialog from '@/components/setting/SettingMailInvitationDialog.vue'
import { listAdminUsers, type AdminUser } from '@/api/adminUsers'
import { issueMailInvitation } from '@/api/mail'

vi.mock('@/api/adminUsers', () => ({ listAdminUsers: vi.fn() }))
vi.mock('@/api/mail', () => ({ issueMailInvitation: vi.fn() }))

const member = {
  uuid: '11111111-1111-4111-8111-111111111111',
  username: 'mail-alice',
  display_name: 'Alice',
  email: 'alice@example.test',
  role: 'user',
  is_active: true,
} as AdminUser

const stubs = {
  PModal: defineComponent({
    props: ['modelValue', 'title'],
    emits: ['update:modelValue'],
    template: '<div v-if="modelValue" role="dialog"><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></div>',
  }),
}

describe('SettingMailInvitationDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listAdminUsers).mockResolvedValue({ data: [member], meta: { page: 1, page_size: 15, total: 1, has_more: false } })
    vi.mocked(issueMailInvitation).mockResolvedValue({
      id: 'invite-1',
      token: 'A'.repeat(43),
      expires_at: '2026-11-11T12:00:00Z',
    })
  })

  it('issues a user-bound invite and displays the secret only while open', async () => {
    const wrapper = mount(SettingMailInvitationDialog, {
      props: { modelValue: true, initialUser: member },
      global: { stubs },
    })
    await flushPromises()
    expect(wrapper.get('[data-testid="mail-invite-selected-user"]').text()).toContain('Alice')
    await wrapper.get('[data-testid="mail-invite-issue"]').trigger('click')
    await flushPromises()
    expect(issueMailInvitation).toHaveBeenCalledExactlyOnceWith(member.uuid)
    expect(wrapper.get('[data-testid="mail-invite-issued"]').text()).toContain('邀请码已生成')
    expect((wrapper.get('[data-testid="mail-invite-result-token"]').element as HTMLInputElement).value).toEqual('A'.repeat(43))
    await wrapper.get('footer button:first-child').trigger('click')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true, initialUser: member })
    await flushPromises()
    expect(wrapper.find('[data-testid="mail-invite-issued"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('searches active Atoman users and never suggests unverified identities', async () => {
    const wrapper = mount(SettingMailInvitationDialog, {
      props: { modelValue: true },
      global: { stubs },
    })
    await flushPromises()
    expect(listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', page: 1 }))
    await wrapper.get('[data-testid="mail-invite-user-11111111-1111-4111-8111-111111111111"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="mail-invite-selected-user"]').text()).toContain('@mail-alice')
    wrapper.unmount()
  })

  it('does not pretend invitation issuance succeeded on disabled mail backend', async () => {
    vi.mocked(issueMailInvitation).mockRejectedValue(new Error('Feature disabled'))
    const wrapper = mount(SettingMailInvitationDialog, {
      props: { modelValue: true, initialUser: member }, global: { stubs },
    })
    await flushPromises()
    await wrapper.get('[data-testid="mail-invite-issue"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('尚未开启')
    expect(wrapper.find('[data-testid="mail-invite-issued"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
