import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MailContactsPanel from '@/views/mail/MailContactsPanel.vue'

const api = vi.hoisted(() => ({
  fetchMailContacts: vi.fn(),
  createMailContact: vi.fn(),
  updateMailContact: vi.fn(),
  deleteMailContact: vi.fn()
}))
vi.mock('@/api/mailClient', () => api)

function setup() {
  return mount(MailContactsPanel, { global: { stubs: { teleport: true } } })
}
beforeEach(() => {
  api.fetchMailContacts.mockReset().mockResolvedValue([
    {id:'known',name:'Existing',email:'known@example.org',notes:'',revision:1,updated_at:''}
  ])
  api.createMailContact.mockReset().mockImplementation(async (row) => ({
    ...row,id:'id-'+row.email,revision:1,updated_at:'2026-11-06'
  }))
  api.updateMailContact.mockReset()
  api.deleteMailContact.mockReset()
})
describe('Private mail address-book imports', () => {
  it('previews only new addresses and never overwrites existing contacts', async () => {
    const w=setup()
    await flushPromises()
    expect(w.get('.mail-contacts__item strong').text()).toBe('Existing')
    const input=w.get('input[type=file]')
    const file=new File(['name,email,notes\nAlready,KNOWN@EXAMPLE.ORG,unchanged\nNew,new@example.org,Hi\n'], 'contacts.csv',{type:'text/csv'})
    Object.defineProperty(input.element, 'files', {value:[file], configurable:true})
    await input.trigger('change'); await flushPromises()
    expect(w.text()).toContain('预计新增')
    expect(w.text()).toContain('1 条')
    expect(w.text()).toContain('new@example.org')
    const button = w.findAll('button').find(b=>b.text().includes('确认新增'))
    expect(button).toBeDefined()
    await button!.trigger('click')
    await flushPromises()
    expect(api.createMailContact).toHaveBeenCalledTimes(1)
    expect(api.createMailContact).toHaveBeenCalledWith({name:'New',email:'new@example.org',notes:'Hi'})
    expect(w.text()).toContain('已成功导入 1 条联系人')
    expect(w.text()).toContain('Existing')
  })
  it('fails closed on malformed import without invoking the API', async () => {
    const w=setup(); await flushPromises()
    const input=w.get('input[type=file]')
    const file=new File(['name,email\nBad,not-an-email\n'], 'bad.csv',{type:'text/csv'})
    Object.defineProperty(input.element,'files',{value:[file],configurable:true})
    await input.trigger('change'); await flushPromises()
    expect(w.get('[role=alert]').text()).toContain('格式无效')
    expect(api.createMailContact).not.toHaveBeenCalled()
  })
  it('permits retry without reimporting a successful prefix after a network failure', async () => {
    api.createMailContact.mockImplementationOnce(async row=>({...row,id:'saved',revision:1,updated_at:''})).mockRejectedValueOnce(new Error('offline'))
    const w=setup();await flushPromises()
    const input=w.get('input[type=file]')
    Object.defineProperty(input.element,'files',{value:[new File(['name,email\nAlice,alice@example.org\nBob,bob@example.org\n'],'retry.csv')],configurable:true})
    await input.trigger('change');await flushPromises()
    const button = () => w.findAll('button').find(b=>b.text().includes('确认新增'))!
    await button().trigger('click'); await flushPromises()
    expect(api.createMailContact).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('已导入 1 条')
    api.fetchMailContacts.mockResolvedValue([
      {id:'known',name:'Existing',email:'known@example.org',notes:'',revision:1,updated_at:''},
      {id:'saved',name:'Alice',email:'alice@example.org',notes:'',revision:1,updated_at:''}
    ])
    await button().trigger('click'); await flushPromises()
    expect(api.createMailContact).toHaveBeenCalledTimes(3)
    expect(api.createMailContact).toHaveBeenLastCalledWith({name:'Bob',email:'bob@example.org',notes:''})
  })
})
