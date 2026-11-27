import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingMailAdminPanel from '@/components/setting/SettingMailAdminPanel.vue'

const mocks = vi.hoisted(() => ({
  listAdminMailAccounts: vi.fn(),
  approveAdminMailAccount: vi.fn(),
  rejectAdminMailAccount: vi.fn(),
  suspendAdminMailAccount: vi.fn(),
  restoreAdminMailAccount: vi.fn(),
  listAdminMailInvites: vi.fn(),
  revokeAdminMailInvite: vi.fn(),
}))

vi.mock('@/api/mail', () => ({
  listAdminMailAccounts: mocks.listAdminMailAccounts,
  approveAdminMailAccount: mocks.approveAdminMailAccount,
  rejectAdminMailAccount: mocks.rejectAdminMailAccount,
  suspendAdminMailAccount: mocks.suspendAdminMailAccount,
  restoreAdminMailAccount: mocks.restoreAdminMailAccount,
  listAdminMailInvites: mocks.listAdminMailInvites,
  revokeAdminMailInvite: mocks.revokeAdminMailInvite,
}))

vi.mock('@/components/setting/SettingMailInvitationDialog.vue', () => ({
  default: { props: ['modelValue'], template: '<div data-testid="invite-dialog" />' },
}))

const pendingRow = {
  id: 'acct-1',
  user_id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
  user_email: 'alice@example.test',
  local_part: 'alice',
  address: 'alice@atoman.org',
  status: 'reserved' as const,
  created_at: '2026-11-26T01:00:00Z',
  updated_at: '2026-11-26T01:00:00Z',
}

describe('SettingMailAdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listAdminMailAccounts.mockResolvedValue([pendingRow])
    mocks.listAdminMailInvites.mockResolvedValue([
      {
        id: 'inv-1',
        target_user_id: 'user-2',
        username: 'bob',
        display_name: 'Bob',
        user_email: 'bob@example.test',
        local_part: 'bob',
        address: 'bob@atoman.org',
        state: 'pending',
        expires_at: '2026-12-03T01:00:00Z',
        created_at: '2026-11-26T01:00:00Z',
      },
    ])
  })

  it('approves a pending mail account and switches its actions to suspend', async () => {
    mocks.approveAdminMailAccount.mockResolvedValue({ ...pendingRow, status: 'active' })
    const wrapper = mount(SettingMailAdminPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('alice@atoman.org')
    expect(wrapper.text()).toContain('待审批')
    await wrapper.get('[data-test="mail-approve-acct-1"]').trigger('click')
    await flushPromises()

    expect(mocks.approveAdminMailAccount).toHaveBeenCalledWith('acct-1')
    expect(wrapper.text()).toContain('已审批通过 alice@atoman.org')
    expect(wrapper.find('[data-test="mail-suspend-acct-1"]').exists()).toBe(true)
  })

  it('switches to invites tab and revokes a pending invite', async () => {
    mocks.revokeAdminMailInvite.mockResolvedValue({
      id: 'inv-1',
      target_user_id: 'user-2',
      username: 'bob',
      display_name: 'Bob',
      user_email: 'bob@example.test',
      local_part: 'bob',
      address: 'bob@atoman.org',
      state: 'revoked',
      expires_at: '2026-12-03T01:00:00Z',
      created_at: '2026-11-26T01:00:00Z',
    })
    const wrapper = mount(SettingMailAdminPanel)
    await flushPromises()

    await wrapper.get('[data-test="mail-admin-tab-invites"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('bob@atoman.org')
    await wrapper.get('[data-test="mail-invite-revoke-inv-1"]').trigger('click')
    await flushPromises()

    expect(mocks.revokeAdminMailInvite).toHaveBeenCalledWith('inv-1')
    expect(wrapper.text()).toContain('已撤销邀请码')
  })
})
