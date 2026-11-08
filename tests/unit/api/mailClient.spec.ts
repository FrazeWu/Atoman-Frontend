import { beforeEach, describe, expect, it, vi } from 'vitest'
const http=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),del:vi.fn(),multipart:vi.fn(),request:vi.fn()}))
vi.mock('@/api/client',()=>({apiGet:http.get,apiPostJson:http.post,apiPutJson:http.put,apiDeleteJson:http.del,apiPostMultipart:http.multipart,apiRequest:http.request}))
vi.mock('@/composables/useApiUrl',()=>({useApiUrl:()=>'/api/v1'}))
import { queryMailMessages, fetchMailThread, fetchMailDraft, saveMailDraft, queueMail, fetchMailSenders, fetchMailAliases, createMailAlias, setMailAliasEnabled, fetchExternalFlagPreview, mutateMailMessages, undoMailAction, fetchMailPreferences, saveMailPreferences } from '@/api/mailClient'
const compose={to:['a@example.test'],cc:[],bcc:[],subject:'hello',text:'body',attachments:[{id:'upload',name:'notes.txt',type:'text/plain',size:5}]}
beforeEach(()=>vi.clearAllMocks())
describe('mail client contract',()=>{
 it('uses search pagination and translates server flags and mailbox ownership',async()=>{
  http.get.mockResolvedValue({items:[{id:'a',isStarred:true,mailboxIds:{inbox:true,old:false}}],position:50,total:52,has_more:true})
  const result=await queryMailMessages('inbox','receipt',50,1)
  expect(http.get).toHaveBeenCalledWith('/api/v1/mail/search?mailbox_id=inbox&limit=1&position=50&q=receipt')
  expect(result.items[0]).toMatchObject({isFlagged:true,mailboxIds:['inbox']});expect(result.next_position).toBe(51)
 })
 it('loads every page of a conversation and carries real mailbox IDs',async()=>{
  http.get.mockResolvedValueOnce({items:[{id:'a',mailboxIds:{inbox:true}}],position:0,has_more:true}).mockResolvedValueOnce({items:[{id:'b',mailboxIds:{sent:true}}],position:1,has_more:false})
  const rows=await fetchMailThread('inbox','thread')
  expect(rows.map(row=>row.id)).toEqual(['a','b']);expect(rows[1].mailboxIds).toEqual(['sent'])
  expect(http.get).toHaveBeenLastCalledWith('/api/v1/mail/search?thread_id=thread&limit=100&position=1')
 })
 it('reads and saves drafts using revision guards and the compose envelope',async()=>{
  http.get.mockResolvedValue({id:'draft',revision:3,subject:'hello',updated_at:'now',compose});http.put.mockResolvedValue({id:'draft',revision:4,subject:'hello',updated_at:'later',compose})
  const draft=await fetchMailDraft('draft');expect(draft).toMatchObject({...compose,revision:3})
  expect((await saveMailDraft(draft)).revision).toBe(4)
  expect(http.put).toHaveBeenCalledWith('/api/v1/mail/drafts/draft',{revision:3,compose})
 })
 it('queues only attachment IDs with the persistent request identity',async()=>{
  http.post.mockResolvedValue({id:'outbox',status:'queued'});await queueMail(compose,'attempt','draft')
  expect(http.post).toHaveBeenCalledWith('/api/v1/mail/outbox',{to:compose.to,cc:[],bcc:[],subject:'hello',text:'body',attachment_ids:['upload'],request_id:'attempt',draft_id:'draft',draft_revision:undefined})
 })
 it('lists only server-approved sender identities and queues opaque external sender id',async()=>{
  http.get.mockResolvedValue([{provider:'atoman',address:'me@atoman.org'},{provider:'gmail',address:'alice@gmail.com',external_account_id:'ext-id'}])
  const senders=await fetchMailSenders()
  expect(senders[1].external_account_id).toBe('ext-id')
  expect(http.get).toHaveBeenCalledWith('/api/v1/mail/senders')
  http.post.mockResolvedValue({id:'outbox'})
  await queueMail({...compose,external_account_id:'ext-id'},'fresh-request')
  expect(http.post.mock.calls[0][1]).toMatchObject({external_account_id:'ext-id',request_id:'fresh-request'})
 })
 it('calls owner-scoped alias lifecycle endpoints without admin credentials',async()=>{
  http.get.mockResolvedValue([{id:'a',address:'my.alias@atoman.org',status:'active'}])
  expect((await fetchMailAliases())[0].address).toBe('my.alias@atoman.org')
  expect(http.get).toHaveBeenCalledWith('/api/v1/mail/aliases')
  http.post.mockResolvedValue({id:'a',address:'my.alias@atoman.org',status:'active'})
  await createMailAlias('my.alias')
  expect(http.post).toHaveBeenCalledWith('/api/v1/mail/aliases',{local_part:'my.alias'})
  await setMailAliasEnabled('a',false)
  expect(http.post).toHaveBeenLastCalledWith('/api/v1/mail/aliases/a/action',{action:'disable'})
 })
 it('requests read-only source/native flag comparison by scoped job and offset',async()=>{
  http.get.mockResolvedValue({job_id:'job',items:[],has_more:false,next_position:8})
  expect((await fetchExternalFlagPreview('account','job',8)).next_position).toBe(8)
  expect(http.get).toHaveBeenCalledWith('/api/v1/mail/external/accounts/account/imports/job/flag-preview?position=8')
 })
 it('uses action receipts and the backend star action',async()=>{
  http.post.mockResolvedValue({updated:['one'],undo_token:'receipt'});expect(await mutateMailMessages('inbox',['one'],'flag')).toMatchObject({affected:1,undo_id:'receipt'})
  expect(http.post).toHaveBeenCalledWith('/api/v1/mail/messages/actions',{ids:['one'],action:'star',mailbox_id:''})
  await undoMailAction('receipt');expect(http.post).toHaveBeenLastCalledWith('/api/v1/mail/messages/actions/undo',{token:'receipt'})
 })
 it('preserves backend preferences while mapping rule and auto-reply fields',async()=>{
  const wire={conversation_mode:false,blocked_senders:['blocked@example.test'],auto_reply:{enabled:true,subject:'Away',text:'Back soon'},rules:[{id:'r',name:'Receipts',enabled:true,field:'subject',contains:'receipt',action:'archive'}]}
  http.get.mockResolvedValue(wire);http.put.mockResolvedValue(wire)
  const settings=await fetchMailPreferences();expect(settings.vacation.text).toBe('Back soon');expect(settings.rules[0]?.value).toBe('receipt')
  await saveMailPreferences(settings);expect(http.put).toHaveBeenCalledWith('/api/v1/mail/settings',{...wire,signature:{enabled:false,text:'',html:'',on_reply:true}})
 })
})
