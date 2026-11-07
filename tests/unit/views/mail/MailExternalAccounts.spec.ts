import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MailExternalAccounts from '@/views/mail/MailExternalAccounts.vue'

const api = vi.hoisted(() => ({
  providers: vi.fn(), unified: vi.fn(), connect: vi.fn(), sync: vi.fn(), disconnect: vi.fn(),
  read: vi.fn(), folders: vi.fn(), messages: vi.fn()
}))
vi.mock('@/api/mail', () => ({ fetchMailFolders: api.folders }))
vi.mock('@/api/mailClient', () => ({
  fetchExternalProviders: api.providers,
  fetchExternalUnifiedInbox: api.unified,
  connectExternalAccount: api.connect,
  syncExternalAccount: api.sync,
  disconnectExternalAccount: api.disconnect,
  fetchExternalMessagePlain: api.read,
  queryMailMessages: api.messages
}))
vi.mock('@/components/ui/PSheet.vue', () => ({
  default: { template: '<div data-testid="sheet"><slot /></div>' }
}))
vi.mock('@/components/ui/PModal.vue', () => ({
  default: { props: ['show'], template: '<div v-if="show" data-testid="modal"><slot /><slot name="footer" /></div>' }
}))
const external = {
  id: 'ext1', provider: 'gmail', address: 'owned@gmail.com', messages_count: 1,
  unread_count: 1, last_synced_at: '2026-11-07T13:00:00Z', last_error_code: '', revision: 1
}
const message = {
  account_id: 'ext1', account_address: 'owned@gmail.com', provider: 'gmail',
  uid: 88, uid_validity: 33, subject: '<script>外部主题</script>',
  from: 'coworker@example.org', from_name: 'Colleague', date: '2026-11-07T10:30:00Z',
  seen: false, size: 900
}
function setup() { return mount(MailExternalAccounts, { attachTo: document.body }) }
beforeEach(() => {
  vi.clearAllMocks()
  api.providers.mockResolvedValue([{id:'gmail',label:'Gmail',host:'imap.gmail.com',port:993}])
  api.unified.mockResolvedValue({accounts:[external],messages:[message]})
  api.folders.mockResolvedValue([{id:'inbox',role:'inbox'}])
  api.messages.mockResolvedValue({items:[{id:'native',receivedAt:'2026-11-07T11:00:00Z',
    subject:'Atoman own email',isRead:false,from:[{name:'Atoman',email:'sender@atoman.org'}]}],total:1})
  api.read.mockResolvedValue({text:'This is text <script>alert(1)</script>'})
  api.connect.mockResolvedValue({...external,id:'new2'})
  api.sync.mockResolvedValue({...external,revision:2})
  api.disconnect.mockResolvedValue({deleted:true})
})
describe('External IMAP unified inbox', () => {
  it('combines native and external messages in chronological order and renders unsafe text as text', async () => {
    const wrapper=setup();await flushPromises()
    const buttons=wrapper.findAll('.mail-external__message')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.text()).toContain('Atoman own email')
    expect(buttons[1]!.text()).toContain('外部主题')
    expect(wrapper.find('script').exists()).toBe(false)
    await buttons[1]!.trigger('click');await flushPromises()
    expect(api.read).toHaveBeenCalledWith('ext1',88,33)
    expect(wrapper.get('[data-testid="external-plain-preview"]').text()).toContain('<script>')
    expect(wrapper.find('script').exists()).toBe(false)
    wrapper.unmount()
  })
  it('never sends a provider password back in fetched account lists', async () => {
    const wrapper=setup();await flushPromises()
    await wrapper.findAll('.p-segmented-control button').at(1)!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('owned@gmail.com')
    expect(wrapper.text()).not.toContain('own-app-password')
    wrapper.unmount()
  })
  it('requires confirmation before unlinking without deleting source mailbox', async () => {
    const wrapper=setup();await flushPromises()
    const tabs=wrapper.findAll('button').find(x=>x.text().includes('管理账户'))!
    await tabs.trigger('click');await flushPromises()
    const remove=wrapper.findAll('button').find(x=>x.text()==='移除')!
    await remove.trigger('click')
    expect(api.disconnect).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('不会删除原邮箱内的邮件')
    const confirm=wrapper.findAll('button').find(x=>x.text()==='确认移除')!
    await confirm.trigger('click');await flushPromises()
    expect(api.disconnect).toHaveBeenCalledWith('ext1')
    wrapper.unmount()
  })
  it('provider errors retain native Inbox and show safe status', async () => {
    api.unified.mockRejectedValue(new Error('example secret log should not be displayed'))
    const wrapper=setup();await flushPromises()
    expect(wrapper.text()).toContain('外部邮箱服务暂时不可用')
    expect(wrapper.text()).not.toContain('example secret log')
    expect(wrapper.text()).toContain('Atoman own email')
    wrapper.unmount()
  })
})
