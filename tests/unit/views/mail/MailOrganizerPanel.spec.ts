import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MailOrganizerPanel from '@/views/mail/MailOrganizerPanel.vue'
import type { MailOrganizerState } from '@/api/mailClient'
import type { MailSummary } from '@/api/mail'
const message:MailSummary={id:'mail-owned-1',threadId:'t1',subject:'计划讨论',receivedAt:'2026-11-06T12:00:00Z',preview:'你好',hasAttachment:false}
const label={id:'l1',name:'项目',color:'blue' as const,revision:1}
function setup(overrides?:Partial<MailOrganizerState>,target:MailSummary|null=message) {
 return mount(MailOrganizerPanel,{
  props:{target,state:{labels:[label],records:[],...overrides},messages:[message],now:Date.now(),busy:false,error:''},
  global:{stubs:{PSheet:{template:'<div><slot /></div>'}}}
 })
}
describe('Private mail organizer',()=>{
 it('creates private label from existing UI components',async()=>{
  const w=setup()
  expect(w.text()).toContain('计划讨论')
  await w.get('.mail-organizer__create-label input').setValue('  研究计划  ')
  await w.get('form.mail-organizer__create-label').trigger('submit')
  expect(w.emitted('create-label')?.[0]).toEqual([{name:'研究计划',color:'blue'}])
 })
 it('renames labels with their server revision',async()=>{
  const w=setup()
  await w.get('button[aria-label="重命名标签 项目"]').trigger('click')
  await w.get('form.mail-organizer__rename input').setValue('  项目任务  ')
  await w.get('form.mail-organizer__rename').trigger('submit')
  expect(w.emitted('update-label')?.[0]).toEqual([{...label,name:'项目任务'}])
 })
 it('adds and removes labels using the current revision',async()=>{
  const w=setup({records:[{message_id:'mail-owned-1',label_ids:[],revision:5}]})
  await w.get('input[type=checkbox]').setValue(true)
  expect(w.emitted('action')?.[0]).toEqual([{message_id:'mail-owned-1',action:'label_add',label_id:'l1',revision:5}])
  await w.setProps({state:{labels:[label],records:[{message_id:'mail-owned-1',label_ids:['l1'],revision:6}]}})
  await w.get('input[type=checkbox]').setValue(false)
  expect(w.emitted('action')?.[1]).toEqual([{message_id:'mail-owned-1',action:'label_remove',label_id:'l1',revision:6}])
 })
 it('displays due follow-up and supports completion',async()=>{
  const old=new Date(Date.now()-3600000).toISOString()
  const w=setup({records:[{message_id:'mail-owned-1',label_ids:[],revision:3,follow_up_at:old}]},null)
  expect(w.text()).toContain('已到期')
  await w.findAll('button').find(b=>b.text().includes('完成跟进'))!.trigger('click')
  expect(w.emitted('action')?.[0]).toEqual([{message_id:'mail-owned-1',action:'clear_follow_up',revision:3}])
 })
 it('sets future snooze and prevents past date',async()=>{
  const w=setup()
  const picker=w.get('input[type=datetime-local]')
  const date=new Date(Date.now()+3*24*3600*1000)
  const pad=(v:number)=>String(v).padStart(2,'0')
  const local=date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes())
  await picker.setValue(local)
  await w.find('.mail-organizer__two-col form').trigger('submit')
  expect(w.emitted('action')?.[0]?.[0]).toMatchObject({message_id:'mail-owned-1',action:'snooze',revision:0})
  const before=w.emitted('action')?.length
  await picker.setValue('2020-01-01T08:00')
  await flushPromises()
  expect(w.findAll('button').find(b=>b.text()==='设置稍后处理')!.attributes('disabled')).toBeDefined()
  expect(w.emitted('action')?.length).toBe(before)
 })
})
