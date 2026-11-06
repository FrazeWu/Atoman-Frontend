import { mount,flushPromises } from '@vue/test-utils'
import { describe,expect,it } from 'vitest'
import MailRecipientField from '@/views/mail/MailRecipientField.vue'

const contacts=[{id:'a',name:'朋友',email:'friend@example.test',notes:'',revision:1,updated_at:'now'},{id:'b',name:'同事',email:'teammate@example.test',notes:'',revision:1,updated_at:'now'}]
describe('Private mail recipient selection',()=>{
 it('recommends private contacts without changing recipients until selected',async()=>{
  const w=mount(MailRecipientField,{props:{modelValue:'first@example.test, fr',label:'收件人',placeholder:'邮箱',contacts}})
  await w.get('input').trigger('focus')
  expect(w.findAll('[role=option]')).toHaveLength(1)
  expect(w.emitted('update:modelValue')).toBeUndefined()
  await w.get('[role=option]').trigger('mousedown');await flushPromises()
  expect(w.emitted('update:modelValue')?.[0]).toEqual(['first@example.test, friend@example.test, '])
 })
 it('does not suggest an address for a one-character query or unknown email',async()=>{
  const w=mount(MailRecipientField,{props:{modelValue:'f',label:'密送',placeholder:'邮箱',contacts}})
  await w.get('input').trigger('focus')
  expect(w.findAll('[role=option]')).toHaveLength(0)
  await w.setProps({modelValue:'unknown'})
  expect(w.findAll('[role=option]')).toHaveLength(0)
 })
})
