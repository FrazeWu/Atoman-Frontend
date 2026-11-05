// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseRecipients, replyRecipients, groupConversations, mailFrameDocument } from '@/views/mail/mail-helpers'
import type { MailDetail } from '@/api/mail'
describe('mail safety and conversation helpers',()=>{
 it('normalizes and deduplicates recipients and rejects malformed input',()=>{
  expect(parseRecipients('A@example.test; b@example.test，a@example.test')).toEqual(['a@example.test','b@example.test'])
  expect(()=>parseRecipients('address-without-domain')).toThrow()
 })
 it('replies to Reply-To and excludes the signed-in mailbox from reply-all',()=>{
  const detail={from:[{name:'',email:'sender@example.test'}],replyTo:[{name:'',email:'reply@example.test'}],to:[{name:'',email:'me@atoman.org'},{name:'',email:'other@example.test'}],cc:[{name:'',email:'reply@example.test'}]} as MailDetail
  expect(replyRecipients(detail,'me@atoman.org',true)).toEqual({to:['reply@example.test','other@example.test'],cc:[]})
 })
 it('uses the newest message as the conversation summary',()=>{
  const a={id:'a',threadId:'t',receivedAt:'2026-11-04T00:00:00Z'},b={id:'b',threadId:'t',receivedAt:'2026-11-05T00:00:00Z'}
  expect(groupConversations([a,b] as never,true)[0]?.latest.id).toBe('b');expect(groupConversations([a,b] as never,false)).toHaveLength(2)
 })
 it('removes active content and all external image loads from rich mail',()=>{
  const html=mailFrameDocument('<script>alert(1)</script><form action="https://bad.test"><input></form><p style="background:url(https://tracker.test)">Hi<img src="https://tracker.test/pixel" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><a href="https://example.test">link</a></p>')
  const doc=new DOMParser().parseFromString(html,'text/html')
  expect(doc.querySelector('script,form,input,img')).toBeNull();expect(doc.querySelector('p')?.getAttribute('style')).toBeNull();expect(doc.querySelector('a')?.getAttribute('href')).toBeNull();expect(html).toContain("default-src 'none'")
 })
})
