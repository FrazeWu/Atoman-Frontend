import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MailAliasesPanel from '@/views/mail/MailAliasesPanel.vue'
const api=vi.hoisted(()=>({fetch:vi.fn(),create:vi.fn(),set:vi.fn()}))
vi.mock('@/api/mailClient',()=>({fetchMailAliases:api.fetch,createMailAlias:api.create,setMailAliasEnabled:api.set}))
function setup(){return mount(MailAliasesPanel,{global:{stubs:{teleport:true}}})}
beforeEach(()=>{
 vi.clearAllMocks()
 api.fetch.mockResolvedValue([{id:'alias-1',address:'alice.secondary@atoman.org',status:'active',created_at:'2026-11-08T12:00:00Z'}])
 api.create.mockResolvedValue({id:'alias-2',address:'second@atoman.org',status:'active'})
 api.set.mockResolvedValue({id:'alias-1',address:'alice.secondary@atoman.org',status:'disabled'})
})
describe('Atoman native alias management',()=>{
 it('lists aliases and does not create invalid local parts',async()=>{
  const w=setup();await flushPromises()
  expect(w.get('[data-testid="mail-alias-alias-1"]').text()).toContain('alice.secondary@atoman.org')
  const input=w.get('[data-testid="mail-alias-input"]')
  const create=()=>w.findAll('button').find(b=>b.text()==='创建别名')!
  await input.setValue('bad..name')
  expect(create().attributes('disabled')).toBeDefined()
  expect(api.create).not.toHaveBeenCalled()
  await input.setValue('my.alias')
  expect(create().attributes('disabled')).toBeUndefined()
  await w.get('form.mail-aliases__new').trigger('submit');await flushPromises()
  expect(api.create).toHaveBeenCalledWith('my.alias')
  w.unmount()
 })
 it('requires confirmation before disabling and never releases address in UI',async()=>{
  const w=setup();await flushPromises()
  await w.findAll('button').find(b=>b.text()==='停用')!.trigger('click')
  expect(api.set).not.toHaveBeenCalled()
  expect(w.text()).toContain('不会删除已有邮件或释放该地址')
  await w.findAll('button').find(b=>b.text()==='确认停用')!.trigger('click')
  await flushPromises()
  expect(api.set).toHaveBeenCalledWith('alias-1',false)
  w.unmount()
 })
 it('does not reissue uncertain remote operations',async()=>{
  api.fetch.mockResolvedValue([{id:'alias-1',address:'alice.secondary@atoman.org',status:'needs_review',error_code:'remote_change_unknown'}])
  const w=setup();await flushPromises()
  expect(w.text()).toContain('需管理员核对')
  expect(w.findAll('button').some(b=>b.text()==='停用'||b.text()==='启用')).toBe(false)
  expect(api.set).not.toHaveBeenCalled()
  w.unmount()
 })
 it('degrades gracefully if alias management is gated off',async()=>{
  api.fetch.mockRejectedValue(new Error('disabled'))
  const w=setup();await flushPromises()
  expect(w.text()).toContain('别名管理尚未启用')
  expect(w.findAll('button').some(b=>b.text()==='创建别名')).toBe(false)
  w.unmount()
 })
})
