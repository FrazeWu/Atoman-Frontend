import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MailExternalAccounts from '@/views/mail/MailExternalAccounts.vue'

const api = vi.hoisted(() => ({
  providers: vi.fn(), unified: vi.fn(), connect: vi.fn(), sync: vi.fn(), disconnect: vi.fn(),
  read: vi.fn(), folders: vi.fn(), messages: vi.fn(), folderList: vi.fn(), folderPage: vi.fn(), flag: vi.fn(), move: vi.fn(), historyList: vi.fn(), historyStart: vi.fn(), historyAction: vi.fn(), flagPreview: vi.fn()
}))
vi.mock('@/api/mail', () => ({ fetchMailFolders: api.folders }))
vi.mock('@/api/mailClient', () => ({
  fetchExternalProviders: api.providers,
  fetchExternalUnifiedInbox: api.unified,
  connectExternalAccount: api.connect,
  syncExternalAccount: api.sync,
  disconnectExternalAccount: api.disconnect,
  fetchExternalMessagePlain: api.read,
  fetchExternalFolders: api.folderList,
  fetchExternalFolderPage: api.folderPage,
  setExternalMessageSeen: api.flag,
  moveExternalMessage: api.move,
  fetchExternalHistoryJobs: api.historyList,
  startExternalHistoryJob: api.historyStart,
  actionExternalHistoryJob: api.historyAction,
  fetchExternalFlagPreview: api.flagPreview,
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
  api.folderList.mockResolvedValue([{name:'INBOX',role:'inbox'},{name:'Archive/2026',role:'archive'}])
  api.folderPage.mockImplementation(async (_account:string,folder:string) => ({
    folder,uid_validity:folder==='INBOX'?33:72,
    messages:[{uid:folder==='INBOX'?88:321,subject:'Archived mail',from:'source@example.test',from_name:'Source',date:'2026-11-07T10:30:00Z',seen:false,size:80}],
    total:1,has_more:false,next_position:1
  }))
  api.flag.mockResolvedValue({updated:true})
  api.move.mockResolvedValue({moved:true,inbox_cache_updated:false,refresh_recommended:false})
  api.historyList.mockResolvedValue([])
  api.historyStart.mockResolvedValue({id:'hist1',account_id:'ext1',folder:'INBOX',status:'queued',imported:0,skipped:0,next_uid:1,upper_uid:30})
  api.flagPreview.mockResolvedValue({job_id:'hist1',folder:'INBOX',checked_at:'2026-11-08T12:00:00Z',next_position:1,has_more:false,items:[{source_uid:88,native_email_id:'native-import',status:'ready',seen:{baseline:false,source:true,native:false,decision:'copy_to_native'},flagged:{baseline:false,source:false,native:false,decision:'in_sync'}}]})
  api.historyAction.mockResolvedValue({id:'hist1',account_id:'ext1',folder:'INBOX',status:'paused',imported:0,skipped:0,next_uid:1,upper_uid:30})
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
    expect(api.read).toHaveBeenCalledWith('ext1',88,33,undefined)
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
  it('lists and pages provider folders without changing remote message state on preview', async () => {
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click');await flushPromises()
    const foldersButton=wrapper.findAll('button').find(b=>b.text()==='文件夹')!
    await foldersButton.trigger('click');await flushPromises()
    expect(api.folderList).toHaveBeenCalledWith('ext1')
    expect(api.folderPage).toHaveBeenCalledWith('ext1','INBOX',0)
    const archived=wrapper.findAll('.mail-external__folder-nav button').find(b=>b.text()==='Archive/2026')!
    await archived.trigger('click');await flushPromises()
    expect(api.folderPage).toHaveBeenLastCalledWith('ext1','Archive/2026',0)
    await wrapper.get('.mail-external__browser .mail-external__message').trigger('click')
    await flushPromises()
    expect(api.read).toHaveBeenCalledWith('ext1',321,72,'Archive/2026')
    expect(api.flag).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('requires explicit confirmation before a provider MOVE', async () => {
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='文件夹')!.trigger('click')
    await flushPromises()
    await wrapper.findAll('.mail-external__folder-nav button').find(b=>b.text()==='Archive/2026')!.trigger('click')
    await flushPromises()
    await wrapper.get('.mail-external__browser .mail-external__message').trigger('click')
    await flushPromises()
    await wrapper.get('.mail-external__move-actions .p-select-trigger').trigger('click')
    await wrapper.findAll('.mail-external__move-actions .p-select-option').find(b=>b.text()==='INBOX')!.trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='移动邮件')!.trigger('click')
    expect(api.move).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(b=>b.text()==='确认移动')!.trigger('click')
    await flushPromises()
    expect(api.move).toHaveBeenCalledWith('ext1',321,72,'Archive/2026','INBOX')
    wrapper.unmount()
  })
  it('requires confirmation to create a private history import job', async () => {
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='文件夹')!.trigger('click')
    await flushPromises()
    expect(api.historyList).toHaveBeenCalledWith('ext1')
    const start=wrapper.findAll('button').find(b=>b.text()==='导入当前文件夹历史')!
    await start.trigger('click')
    expect(api.historyStart).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('不会被移除')
    const confirm=wrapper.findAll('button').find(b=>b.text()==='确认创建任务')!
    await confirm.trigger('click');await flushPromises()
    expect(api.historyStart).toHaveBeenCalledWith('ext1','INBOX',false)
    wrapper.unmount()
  })
  it('opt-in creates a continuous import only after explicit selection', async () => {
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='文件夹')!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(b=>b.text()==='导入当前文件夹历史')!.trigger('click')
    await wrapper.get('[data-testid="history-live-optin"]').setValue(true)
    expect(api.historyStart).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(b=>b.text()==='确认创建任务')!.trigger('click')
    await flushPromises()
    expect(api.historyStart).toHaveBeenCalledWith('ext1','INBOX',true)
    wrapper.unmount()
  })
  it('starts and stops continuous import without exposing destructive controls', async () => {
    api.historyList.mockResolvedValue([{id:'hist1',account_id:'ext1',folder:'INBOX',status:'completed',continuous:false,upper_uid:1,next_uid:2,imported:1,skipped:0}])
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='文件夹')!.trigger('click');await flushPromises()
    await wrapper.findAll('button').find(b=>b.text()==='开启新增邮件同步')!.trigger('click');await flushPromises()
    expect(api.historyAction).toHaveBeenCalledWith('ext1','hist1','enable_live')
    api.historyList.mockResolvedValue([{id:'hist1',account_id:'ext1',folder:'INBOX',status:'watching',continuous:true,upper_uid:1,next_uid:2,imported:1,skipped:0}])
    await wrapper.findAll('button').find(b=>b.text()==='刷新进度')!.trigger('click');await flushPromises()
    expect(wrapper.text()).toContain('持续检查新增邮件')
    await wrapper.findAll('button').find(b=>b.text()==='关闭新增邮件同步')!.trigger('click');await flushPromises()
    expect(api.historyAction).toHaveBeenCalledWith('ext1','hist1','disable_live')
    expect(wrapper.text()).not.toContain('永久删除')
    wrapper.unmount()
  })
  it('renders history state without exposing provider credentials', async () => {
    api.historyList.mockResolvedValue([{id:'hist1',account_id:'ext1',folder:'INBOX',status:'needs_review',upper_uid:10,next_uid:3,imported:2,skipped:0,last_error_code:'ambiguous_import'}])
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='文件夹')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="external-history-hist1"]').text()).toContain('需人工核对')
    expect(wrapper.get('[data-testid="external-history-hist1"]').text()).toContain('2 封')
    expect(wrapper.text()).not.toContain('own-app-password')
    expect(wrapper.findAll('button').some(b=>b.text()==='继续')).toBe(false)
    wrapper.unmount()
  })
  it('compares source and native flag changes without issuing any write', async () => {
    api.historyList.mockResolvedValue([{id:'hist1',account_id:'ext1',folder:'INBOX',status:'completed',continuous:false,upper_uid:88,next_uid:89,imported:1,skipped:0}])
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='文件夹')!.trigger('click');await flushPromises()
    await wrapper.findAll('button').find(b=>b.text()==='只读检查状态差异')!.trigger('click');await flushPromises()
    expect(api.flagPreview).toHaveBeenCalledWith('ext1','hist1',0)
    expect(wrapper.get('[data-testid="external-flag-preview"]').text()).toContain('建议更新 Atoman')
    expect(wrapper.text()).toContain('只读对比，不会修改')
    expect(api.flag).not.toHaveBeenCalled()
    expect(api.move).not.toHaveBeenCalled()
    expect(api.historyAction).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('shows unknown baseline and missing source without recommending writes', async () => {
    api.historyList.mockResolvedValue([{id:'hist1',account_id:'ext1',folder:'INBOX',status:'completed',upper_uid:88,next_uid:89,imported:1,skipped:0}])
    api.flagPreview.mockResolvedValue({job_id:'hist1',folder:'INBOX',next_position:2,has_more:false,checked_at:'2026-11-08T12:00:00Z',items:[
      {source_uid:2,native_email_id:'old',status:'baseline_unknown'},
      {source_uid:3,native_email_id:'missing',status:'source_missing'}]})
    const wrapper=setup();await flushPromises()
    await wrapper.get('[data-testid="mode-accounts"]').trigger('click')
    await wrapper.findAll('button').find(b=>b.text()==='文件夹')!.trigger('click');await flushPromises()
    await wrapper.findAll('button').find(b=>b.text()==='只读检查状态差异')!.trigger('click');await flushPromises()
    expect(wrapper.text()).toContain('缺少初始状态，需核对')
    expect(wrapper.text()).toContain('原邮箱已找不到该邮件')
    expect(api.move).not.toHaveBeenCalled()
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
