import { mount,flushPromises } from '@vue/test-utils'
import { describe,expect,it } from 'vitest'
import MailAdvancedSearch from '@/views/mail/MailAdvancedSearch.vue'
describe('Advanced mailbox search dialog',()=>{
 it('combines sender, subject, date range and cross-folder scope',async()=>{
  const w=mount(MailAdvancedSearch,{props:{filters:{},everywhere:false},global:{stubs:{teleport:true}}})
  await w.get('input[placeholder="姓名或邮箱"]').setValue('alice@example.test')
  await w.get('input[placeholder="关键词"]').setValue('invoice')
  await w.get('input[type=date]').setValue('2026-11-01')
  await w.get('input[type=checkbox]').setValue(true)
  await w.get('form').trigger('submit');await flushPromises()
  expect(w.emitted('apply')).toHaveLength(1)
  expect(w.emitted('apply')?.[0]?.[0]).toMatchObject({from:'alice@example.test',subject:'invoice',after:new Date('2026-11-01T00:00:00').toISOString()})
  expect(w.emitted('apply')?.[0]?.[1]).toBe(true)
 })
 it('refuses invalid date order',async()=>{
  const w=mount(MailAdvancedSearch,{props:{filters:{},everywhere:false},global:{stubs:{teleport:true}}})
  await w.findAll('input[type=date]')[0]!.setValue('2026-11-10')
  await w.findAll('input[type=date]')[1]!.setValue('2026-11-01')
  await w.get('form').trigger('submit')
  expect(w.emitted('apply')).toBeUndefined()
  expect(w.get('[role=alert]').text()).toContain('起始日期')
 })
})
