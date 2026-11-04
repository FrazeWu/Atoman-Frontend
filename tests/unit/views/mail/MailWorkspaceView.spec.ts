import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MailWorkspaceView from '@/views/mail/MailWorkspaceView.vue'
import type { MailAccountInfo, MailFolder, MailSummary } from '@/api/mail'

const loadAccount = vi.fn<() => Promise<MailAccountInfo>>()
const loadFolders = vi.fn<() => Promise<MailFolder[]>>()
const loadMessages = vi.fn<(folderId: string, limit?: number) => Promise<MailSummary[]>>()
const redeemInvite = vi.fn<(token: string) => Promise<MailAccountInfo>>()

vi.mock('@/api/mail', () => ({
  fetchMyMailAccount: (...args: []) => loadAccount(...args),
  fetchMailFolders: (...args: []) => loadFolders(...args),
  fetchMailSummaries: (folderId: string, limit?: number) => loadMessages(folderId, limit),
  redeemMailInvitation: (token: string) => redeemInvite(token),
}))

const activeAccount: MailAccountInfo = { status: 'active', available: true, address: 'alice@atoman.org' }
const pendingAccount: MailAccountInfo = { status: 'reserved', available: false, address: 'alice@atoman.org' }
const testFolders: MailFolder[] = [
  { id: 'a', name: 'Inbox', role: 'inbox', parentId: null, totalEmails: 1, unreadEmails: 1 },
  { id: 'b', name: 'Junk Mail', role: 'junk', parentId: null, totalEmails: 1, unreadEmails: 0 },
]
const receivedMail: MailSummary = {
  id: 'mail-1', threadId: 'thread-1', subject: '真实邮件主题', preview: '这是后端返回的内容摘要',
  receivedAt: '2026-11-04T11:00:00Z', hasAttachment: true,
}

const mountView = () => mount(MailWorkspaceView, { attachTo: document.body })

describe('Atoman Mail workspace', () => {
  beforeEach(() => {
    loadAccount.mockReset()
    loadFolders.mockReset()
    loadMessages.mockReset()
    redeemInvite.mockReset()
    loadAccount.mockResolvedValue(pendingAccount)
    loadFolders.mockResolvedValue(testFolders)
    loadMessages.mockResolvedValue([receivedMail])
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('shows reserved mail account without calling any message API', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get('[data-testid="mail-not-active"]').text()).toContain('邮箱地址已预留')
    expect(wrapper.text()).toContain('alice@atoman.org')
    expect(wrapper.text()).toContain('当前不可收发邮件')
    expect(wrapper.find('[data-testid="mail-active-workspace"]').exists()).toBe(false)
    expect(loadFolders).not.toHaveBeenCalled()
    expect(loadMessages).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('never assumes mailbox is active based on a status string alone', async () => {
    loadAccount.mockResolvedValue({ status: 'active', available: false, address: 'alice@atoman.org' })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="mail-active-workspace"]').exists()).toBe(false)
    expect(loadFolders).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows invitation form and reserves address without showing a fake inbox', async () => {
    loadAccount.mockResolvedValue({ status: 'not_invited', available: false })
    redeemInvite.mockResolvedValue(pendingAccount)
    const wrapper = mountView()
    await flushPromises()
    const token = 'a'.repeat(43)
    await wrapper.get('#mail-invitation').setValue(token)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(redeemInvite).toHaveBeenCalledWith(token)
    expect(wrapper.get('[data-testid="mail-not-active"]').text()).toContain('邮箱地址已预留')
    expect(loadMessages).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('loads actual folders, switches to junk, and shows preview-only message details', async () => {
    loadAccount.mockResolvedValue(activeAccount)
    loadMessages.mockImplementation(async (folderId) => folderId === 'a' ? [receivedMail] : [{ ...receivedMail, id: 'mail-junk', subject: '垃圾邮件测试', hasAttachment: false }])
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get('[data-testid="mail-active-workspace"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('收件箱')
    expect(loadMessages).toHaveBeenCalledWith('a', 50)
    await wrapper.get('[data-testid="mail-message-mail-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="mail-selected-preview"]').text()).toContain('这是后端返回的内容摘要')
    expect(wrapper.text()).toContain('完整正文、附件下载、回复和转发尚未开放')
    expect(wrapper.get('[data-testid="mail-reader-pane"]').classes()).toContain('mail-mobile-visible')
    await wrapper.get('[aria-label="返回邮件列表"]').trigger('click')
    expect(wrapper.get('[data-testid="mail-list-pane"]').classes()).toContain('mail-mobile-visible')
    await wrapper.get('[aria-label="返回文件夹"]').trigger('click')
    expect(wrapper.get('[data-testid="mail-folder-pane"]').classes()).toContain('mail-mobile-visible')
    await wrapper.get('[aria-label="邮件文件夹列表"] button:nth-child(2)').trigger('click')
    await flushPromises()
    expect(loadMessages).toHaveBeenCalledWith('b', 50)
    expect(wrapper.text()).toContain('垃圾邮件测试')
    expect(wrapper.find('[data-testid="mail-selected-preview"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not mix messages from a slower old folder request into the new folder', async () => {
    loadAccount.mockResolvedValue(activeAccount)
    let resolveFirst!: (messages: MailSummary[]) => void
    loadMessages.mockImplementation((folderId) => folderId === 'a'
      ? new Promise<MailSummary[]>(resolve => { resolveFirst = resolve })
      : Promise.resolve([{ ...receivedMail, id: 'new-message', subject: '新文件夹的邮件' }]))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[aria-label="邮件文件夹列表"] button:nth-child(2)').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('新文件夹的邮件')
    resolveFirst([receivedMail])
    await flushPromises()
    expect(wrapper.text()).not.toContain('真实邮件主题')
    expect(wrapper.text()).toContain('新文件夹的邮件')
    wrapper.unmount()
  })

  it('reports unavailable backend instead of showing sample messages', async () => {
    loadAccount.mockRejectedValue(new Error('Unavailable'))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.get('[data-testid="mail-account-error"]').text()).toContain('暂时无法连接邮箱')
    expect(wrapper.find('[data-testid="mail-active-workspace"]').exists()).toBe(false)
    expect(loadMessages).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
