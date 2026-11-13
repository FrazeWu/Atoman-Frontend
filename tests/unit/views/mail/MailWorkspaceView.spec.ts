import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MailWorkspaceView from '@/views/mail/MailWorkspaceView.vue'
import type { MailDetail, MailSummary } from '@/api/mail'
const api = vi.hoisted(() => ({ organizer:vi.fn(),organizerAction:vi.fn(),labelCreate:vi.fn(),labelDelete:vi.fn(),account: vi.fn(), folders: vi.fn(), messages: vi.fn(), detail: vi.fn(), read: vi.fn(), thread: vi.fn(), drafts: vi.fn(), draft: vi.fn(), queue: vi.fn(), outbox: vi.fn(), cancel: vi.fn(), action: vi.fn(), undo: vi.fn(), reserve: vi.fn(), activate: vi.fn() }))
const auth = vi.hoisted(() => ({ user: { role: 'user' } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/api/mail', () => ({ fetchMyMailAccount: api.account, fetchMailFolders: api.folders, fetchMailDetail: api.detail, markMailRead: api.read, reserveAdminMailAddress: api.reserve, redeemMailInvitation: api.activate }))
vi.mock('@/api/mailClient', () => ({ fetchMailOrganizer:api.organizer,mutateMailOrganizer:api.organizerAction,createMailOrganizerLabel:api.labelCreate,deleteMailOrganizerLabel:api.labelDelete,queryMailMessages: api.messages, fetchMailThread: api.thread, fetchMailDrafts: api.drafts, fetchMailDraft: api.draft, fetchMailOutboxes: api.queue, fetchMailOutbox: api.outbox, cancelMailOutbox: api.cancel, mutateMailMessages: api.action, undoMailAction: api.undo, provisionMailAccount: vi.fn(), reconcileMailOutbox: vi.fn(), createMailFolder: vi.fn(), deleteMailFolder: vi.fn(), deleteMailDraft: vi.fn(), downloadMailAttachment: vi.fn(), fetchMailPreferences: vi.fn(), saveMailPreferences: vi.fn() }))
vi.mock('@/views/mail/MailComposer.vue', () => ({ default: { props: ['draft', 'address'], template: '<div data-testid="composer">{{ draft.subject }}</div>' } }))
vi.mock('@/views/mail/MailSettings.vue', () => ({ default: { template: '<div />' } }))
const folders = [{ id: 'inbox', name: 'Inbox', role: 'inbox', parentId: null, totalEmails: 2, unreadEmails: 2 }, { id: 'trash', name: 'Trash', role: 'trash', parentId: null, totalEmails: 0, unreadEmails: 0 }, { id: 'drafts', name: 'Drafts', role: 'drafts', parentId: null, totalEmails: 1, unreadEmails: 0 }]
const first: MailSummary = { id: 'one', threadId: 'thread', subject: '项目进展', preview: '第一封摘要', receivedAt: '2026-11-05T09:00:00Z', hasAttachment: false, from: [{name:'同事',email:'coworker@example.test'}], isRead: false, mailboxIds: ['inbox'] }
const latest: MailSummary = { ...first, id: 'two', preview: '最新摘要', receivedAt: '2026-11-05T10:00:00Z' }
function detail(id: string): MailDetail { return { id, threadId: 'thread', subject: '项目进展', receivedAt: latest.receivedAt, from: first.from!, to: [{name:'',email:'me@atoman.org'}], cc: [], plainText: '<script>正文作为文字显示</script>', hasPlainText: true, bodyTruncated: false, attachments: [], isRead: false } }
const mounted: Array<ReturnType<typeof mount>> = []
function mountView() { const wrapper = mount(MailWorkspaceView, { attachTo: document.body }); mounted.push(wrapper); return wrapper }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); auth.user.role = 'user'
  api.organizer.mockResolvedValue({labels:[],records:[]}); api.organizerAction.mockResolvedValue({message_id:'two',label_ids:[],revision:2})
  api.labelCreate.mockResolvedValue({id:'label-created',name:'项目',color:'blue',revision:1}); api.labelDelete.mockResolvedValue({deleted:true})
  api.account.mockResolvedValue({ available: true, status: 'active', address: 'me@atoman.org' }); api.folders.mockResolvedValue(folders)
  api.messages.mockImplementation((id: string) => Promise.resolve({ items: id === 'inbox' ? [latest, first] : [], total: id === 'inbox' ? 2 : 0, has_more: false }))
  api.thread.mockResolvedValue([first, latest]); api.detail.mockImplementation((_folder: string, id: string) => Promise.resolve(detail(id))); api.read.mockResolvedValue({read:true}); api.queue.mockResolvedValue([]); api.drafts.mockResolvedValue([])
  api.action.mockResolvedValue({ affected: 2, updated: ['one','two'], undo_id: 'receipt' }); api.undo.mockResolvedValue({updated:['one','two']})
})
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = ''; vi.useRealTimers() })
describe('Mail workspace', () => {
  it('requires both active status and availability before loading mailbox data', async () => {
    api.account.mockResolvedValue({ status:'active',available:false,address:'me@atoman.org' })
    const wrapper=mountView(); await flushPromises()
    expect(wrapper.find('[data-testid="mail-active-workspace"]').exists()).toBe(false); expect(api.messages).not.toHaveBeenCalled()
  })
  it('groups conversations by default without marking collapsed mail read', async () => {
    const wrapper=mountView(); await flushPromises()
    expect(wrapper.findAll('[data-testid^="mail-message-"]')).toHaveLength(1); expect(api.read).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="mail-message-two"]').trigger('click'); await flushPromises()
    expect(api.read).toHaveBeenCalledTimes(1); expect(api.read).toHaveBeenCalledWith('inbox','two')
    expect(wrapper.get('[data-testid="mail-plain-text"]').text()).toContain('<script>'); expect(wrapper.find('script').exists()).toBe(false)
    const summaries=wrapper.findAll('.mail-workspace__thread-summary')
    expect(summaries).toHaveLength(2); await summaries[0]!.trigger('click'); await flushPromises()
    expect(api.read).toHaveBeenCalledTimes(2); expect(api.read).toHaveBeenLastCalledWith('inbox','one')
  })
  it('switches to individual messages and keeps the choice', async () => {
    const wrapper=mountView(); await flushPromises(); await wrapper.get('[data-testid="mode-single"]').trigger('click'); await flushPromises()
    expect(wrapper.findAll('[data-testid^="mail-message-"]')).toHaveLength(2); expect(localStorage.getItem('atoman.mail.conversations')).toBe('false')
  })
  it('does not mark a stale detail response read after changing folders', async () => {
    let resolve!: (value:MailDetail)=>void; api.detail.mockImplementation(()=>new Promise<MailDetail>(r=>{resolve=r}))
    const wrapper=mountView(); await flushPromises(); await wrapper.get('[data-testid="mail-message-two"]').trigger('click'); await flushPromises()
    await wrapper.findAll('.mail-workspace__folder')[1]!.trigger('click'); await flushPromises(); resolve(detail('two')); await flushPromises()
    expect(api.read).not.toHaveBeenCalled(); expect(wrapper.find('[data-testid="mail-plain-text"]').exists()).toBe(false)
  })
  it('uses server search and supports bulk actions with server undo', async () => {
    const wrapper=mountView(); await flushPromises(); await wrapper.get('input[aria-label="搜索邮件"]').setValue('进展'); await wrapper.get('.p-search-input__action-btn').trigger('click'); await flushPromises()
    expect(api.messages).toHaveBeenLastCalledWith('inbox','进展',0,50,{})
    await wrapper.get('input[aria-label="选择当前列表全部邮件"]').setValue(true); await wrapper.get('button[aria-label="归档所选邮件"]').trigger('click'); await flushPromises()
    expect(api.action).toHaveBeenCalledWith('inbox',['two','one'],'archive',undefined)
    const undo=wrapper.findAll('button').find(b=>b.text()==='撤销操作')!; await undo.trigger('click'); await flushPromises(); expect(api.undo).toHaveBeenCalledWith('receipt')
  })
  it('keeps compose reachable from the mobile list and shows accessible folder counts', async () => {
    const wrapper=mountView(); await flushPromises()
    expect(wrapper.get('.mail-workspace__mobile-compose').attributes('aria-label')).toBe('写邮件')
    expect(wrapper.get('.mail-workspace__folder-count').attributes('aria-label')).toBe('2 封未读')
    await wrapper.get('.mail-workspace__mobile-compose').trigger('click'); await flushPromises()
    expect(wrapper.find('[data-testid="composer"]').exists()).toBe(true)
  })
  it('filters current folder by Atoman encrypted labels',async()=>{
    api.organizer.mockResolvedValue({labels:[{id:'l1',name:'重要',color:'red',revision:1}],records:[
      {message_id:'one',label_ids:['l1'],revision:1}
    ]})
    const w=mountView();await flushPromises()
    await w.get('[data-testid="mode-single"]').trigger('click');await flushPromises()
    expect(w.findAll('[data-testid^="mail-message-"]')).toHaveLength(2)
    await w.get('.mail-organizer__sidebar-labels button[aria-pressed="false"]').trigger('click');await flushPromises()
    expect(w.findAll('[data-testid^="mail-message-"]')).toHaveLength(1)
    expect(w.get('[data-testid="mail-message-one"]').exists()).toBe(true)
  })
  it('hides future snoozed conversation and omits hidden messages from select-all', async () => {
    const future=new Date(Date.now()+60*60*1000).toISOString()
    api.organizer.mockResolvedValue({labels:[],records:[
      {message_id:'two',snooze_until:future,label_ids:[],revision:1}
    ]})
    const wrapper=mountView(); await flushPromises()
    expect(wrapper.findAll('[data-testid^="mail-message-"]')).toHaveLength(0)
    await wrapper.get('input[aria-label="选择当前列表全部邮件"]').setValue(true)
    await flushPromises()
    expect(wrapper.find('button[aria-label="归档所选邮件"]').exists()).toBe(false)
  })
  it('restores expired snoozed conversations to the Inbox list', async () => {
    const past=new Date(Date.now()-60*60*1000).toISOString()
    api.organizer.mockResolvedValue({labels:[],records:[
      {message_id:'one',snooze_until:past,label_ids:[],revision:1},
      {message_id:'two',snooze_until:past,label_ids:[],revision:1}
    ]})
    const wrapper=mountView();await flushPromises()
    expect(wrapper.findAll('[data-testid^="mail-message-"]')).toHaveLength(1)
  })
  it('recovers the server pending send after refresh and waits for confirmed cancellation', async () => {
    const queued={id:'queue-1',status:'queued',send_after:new Date(Date.now()+5000).toISOString(),created_at:new Date().toISOString()}; api.queue.mockResolvedValue([queued]); api.cancel.mockResolvedValue({...queued,status:'cancelled'})
    const wrapper=mountView(); await flushPromises(); expect(wrapper.text()).toContain('撤销发送')
    const undo=wrapper.findAll('button').find(b=>b.text().includes('撤销发送'))!; await undo.trigger('click'); await flushPromises()
    expect(api.cancel).toHaveBeenCalledWith('queue-1'); expect(wrapper.text()).toContain('发送已撤销')
  })
  it('supports keyboard shortcuts for archive, star, and escape in floating reader', async () => {
    const wrapper = mountView(); await flushPromises()
    await wrapper.get('[data-testid="mail-message-two"]').trigger('click'); await flushPromises()
    expect(wrapper.find('[data-testid="mail-plain-text"]').exists()).toBe(true)

    // S toggles star
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    await flushPromises()
    expect(api.action).toHaveBeenCalledWith('inbox', ['two'], 'flag', undefined)

    // E archives
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }))
    await flushPromises()
    expect(api.action).toHaveBeenCalledWith('inbox', ['one', 'two'], 'archive', undefined)

    // Escape closes reader
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-testid="mail-plain-text"]').exists()).toBe(false)
  })
  it('uses full-width PSheet mode and supports navigation between mails', async () => {
    const wrapper = mountView(); await flushPromises()
    await wrapper.get('[data-testid="mode-single"]').trigger('click'); await flushPromises()
    const rows = wrapper.findAll('[data-testid^="mail-message-"]')
    expect(rows).toHaveLength(2)

    await rows[0]!.trigger('click'); await flushPromises()
    const sheet = wrapper.findComponent({ name: 'PSheet' })
    expect(sheet.exists()).toBe(true)
    expect(sheet.props('mode')).toBe('full')
    expect(sheet.props('contentMaxWidth')).toBe('96rem')
    expect(sheet.props('navigation')).toBeDefined()

    // Press 'j' to navigate to next mail
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    await flushPromises()
    expect(api.read).toHaveBeenCalledWith('inbox', 'one')
  })
})
