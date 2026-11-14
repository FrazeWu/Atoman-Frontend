import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiErrorResponseError } from '@/api/client'
import MailComposer from '@/views/mail/MailComposer.vue'
const api=vi.hoisted(()=>({save:vi.fn(),queue:vi.fn(),remove:vi.fn(),upload:vi.fn(),senders:vi.fn()}))
vi.mock('vue-router',()=>({onBeforeRouteLeave:vi.fn()}))
vi.mock('@/api/mailClient',()=>({saveMailDraft:api.save,queueMail:api.queue,deleteMailDraft:api.remove,uploadMailAttachment:api.upload, fetchMailSenders:api.senders}))
vi.mock('@/components/ui/PSheet.vue',()=>({default:{emits:['close'],template:'<section><button aria-label="关闭写信" @click="$emit(\'close\')">close</button><slot /></section>'}}))
vi.mock('@/components/ui/PModal.vue',()=>({default:{template:'<section><slot /><slot name="footer" /></section>'}}))
vi.mock('@/components/shared/PEditor.vue',()=>({default:{name:'PEditor',props:['modelValue','disabled','editorAriaLabel'],emits:['update:modelValue'],template:'<textarea :value="modelValue" :aria-label="editorAriaLabel" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />'}}))
const draft={id:'11111111-1111-4111-8111-111111111111',to:[],cc:[],bcc:[],subject:'',text:'',attachments:[]}
const mounted:Array<ReturnType<typeof mount>>=[]
function mountComposer(props={}){const w=mount(MailComposer,{props:{address:'me@atoman.org',draft,...props}});mounted.push(w);return w}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();api.save.mockImplementation(async value=>({...value,revision:(value.revision||0)+1,updated_at:'2026-11-05T12:00:00Z'}));api.queue.mockResolvedValue({id:'outbox',status:'queued',send_after:'2026-11-05T12:00:05Z'});api.remove.mockResolvedValue({deleted:true});api.senders.mockResolvedValue([{address:'me@atoman.org',provider:'atoman'}, {address:'alice@gmail.com',provider:'gmail',external_account_id:'12345678-0000-4000-8000-000000000123'}])})
afterEach(()=>{mounted.splice(0).forEach(w=>w.unmount());vi.useRealTimers()})
describe('Mail composer',()=>{
 it('saves revisions in order and flushes edits made during a pending save before closing',async()=>{
  vi.useFakeTimers();let release!:(v:unknown)=>void
  api.save.mockImplementationOnce(value=>new Promise(resolve=>{release=()=>resolve({...value,revision:1,updated_at:'now'})}))
  const w=mountComposer();await w.get('input[aria-label="收件人"]').setValue('a@example.test');await w.get('textarea').setValue('first');await vi.advanceTimersByTimeAsync(950)
  expect(api.save).toHaveBeenCalledTimes(1);expect(api.save.mock.calls[0][0].revision).toBe(0)
  await w.get('textarea').setValue('second');await w.get('button[aria-label="关闭写信"]').trigger('click');expect(w.emitted('close')).toBeUndefined()
  release({});await vi.advanceTimersByTimeAsync(1);await flushPromises()
  expect(api.save).toHaveBeenCalledTimes(2);expect(api.save.mock.calls[1][0]).toMatchObject({revision:1,text:'second'});expect(w.emitted('close')).toHaveLength(1)
 })
 it('persists a draft before explicitly sending and retains one retry identity',async()=>{
  api.queue.mockRejectedValueOnce(new Error('connection interrupted'))
  const w=mountComposer();await w.get('input[aria-label="收件人"]').setValue('a@example.test');await w.get('textarea').setValue('Hello');await w.get('form').trigger('submit');await flushPromises()
  expect(api.save).toHaveBeenCalledTimes(1);expect(api.queue).toHaveBeenCalledTimes(1);expect(w.emitted('queued')).toBeUndefined();expect(w.get('textarea').attributes('disabled')).toBeDefined()
  const firstId=api.queue.mock.calls[0][1];await w.get('form').trigger('submit');await flushPromises()
  expect(api.queue.mock.calls[1][1]).toBe(firstId);expect(api.queue.mock.calls[1][2]).toBe(draft.id);expect(api.queue.mock.calls[1][3]).toBe(1);expect(w.emitted('queued')).toHaveLength(1)
 })
 it('accepts a Bcc-only recipient and submits the saved revision',async()=>{
  const w=mountComposer();await w.get('input[aria-label="密送"]').setValue('private@example.test');await w.get('textarea').setValue('Hello');await w.get('form').trigger('submit');await flushPromises()
  expect(api.queue).toHaveBeenCalledTimes(1);expect(api.queue.mock.calls[0][0]).toMatchObject({to:[],bcc:['private@example.test']})
 })
 it('uses only the selected connected sender in saved draft and durable send',async()=>{
  const w=mountComposer();await flushPromises()
  const sender=w.get('[data-testid="mail-sender-select"]')
  expect(sender.findAll('option')).toHaveLength(2)
  await sender.setValue('12345678-0000-4000-8000-000000000123')
  await w.get('input[aria-label="收件人"]').setValue('reply@example.test')
  await w.get('textarea').setValue('Hello from authenticated Gmail')
  await w.get('form').trigger('submit');await flushPromises()
  expect(api.save).toHaveBeenCalledWith(expect.objectContaining({external_account_id:'12345678-0000-4000-8000-000000000123'}))
  expect(api.queue.mock.calls[0][0]).toMatchObject({external_account_id:'12345678-0000-4000-8000-000000000123'})
  expect(w.emitted('queued')).toHaveLength(1)
 })
 it('retains disconnected draft sender and forbids accidental primary fallback',async()=>{
  api.senders.mockResolvedValue([{address:'me@atoman.org',provider:'atoman'}])
  const w=mountComposer({draft:{...draft,external_account_id:'12345678-0000-4000-8000-000000000123'}})
  await flushPromises()
  expect(w.text()).toContain('原发件地址已停用或不可用')
  await w.get('input[aria-label="收件人"]').setValue('reply@example.test')
  await w.get('textarea').setValue('Stop on missing sender')
  await w.get('form').trigger('submit');await flushPromises()
  expect(api.queue).not.toHaveBeenCalled()
  expect(w.text()).toContain('原发件地址已停用或不可用')
 })
 it('persists a native alias as alias_id, not as an external account',async()=>{
  api.senders.mockResolvedValue([{address:'me@atoman.org',provider:'atoman'},{address:'my.alias@atoman.org',provider:'atoman-alias',alias_id:'55555555-5555-4555-8555-555555555555'}])
  const w=mountComposer();await flushPromises()
  await w.get('[data-testid="mail-sender-select"]').setValue('alias:55555555-5555-4555-8555-555555555555')
  await w.get('input[aria-label="收件人"]').setValue('friend@example.test')
  await w.get('textarea').setValue('Hello through alias')
  await w.get('form').trigger('submit');await flushPromises()
  const saved=api.save.mock.calls[0][0]
  expect(saved.alias_id).toBe('55555555-5555-4555-8555-555555555555')
  expect(saved.external_account_id).toBeUndefined()
  expect(api.queue.mock.calls[0][0]).toMatchObject({alias_id:'55555555-5555-4555-8555-555555555555'})
  expect(api.queue.mock.calls[0][0].external_account_id).toBeUndefined()
 })
 it('blocks a saved alias that was disabled since the draft was created',async()=>{
  api.senders.mockResolvedValue([{address:'me@atoman.org',provider:'atoman'}])
  const w=mountComposer({draft:{...draft,alias_id:'55555555-5555-4555-8555-555555555555'}});await flushPromises()
  await w.get('input[aria-label="收件人"]').setValue('friend@example.test')
  await w.get('textarea').setValue('Do not change sender silently')
  await w.get('form').trigger('submit');await flushPromises()
  expect(api.queue).not.toHaveBeenCalled()
  expect(w.text()).toContain('原发件地址已停用或不可用')
 })
 it('keeps conflicting edits and offers a new draft without overwriting another version',async()=>{
  api.save.mockRejectedValueOnce(new ApiErrorResponseError(409,'conflict','revision changed'))
  const w=mountComposer({draft:{...draft,revision:3,updated_at:'earlier',text:'old'}})
  await w.get('textarea').setValue('my changed body');await w.get('button[aria-label="关闭写信"]').trigger('click');await flushPromises()
  expect(w.emitted('close')).toBeUndefined();expect(w.text()).toContain('另一处更新')
  const copy=w.findAll('button').find(button=>button.text()==='另存为新草稿')!
  await copy.trigger('click');await flushPromises()
  expect(api.save.mock.calls[1][0]).toMatchObject({revision:0,text:'my changed body'});expect(api.save.mock.calls[1][0].id).not.toBe(draft.id)
 })
 it('leaves a draft open when saving fails and never queues it',async()=>{
  api.save.mockRejectedValue(new Error('offline'));const w=mountComposer();await w.get('input[aria-label="收件人"]').setValue('a@example.test');await w.get('textarea').setValue('Hello');await w.get('button[aria-label="关闭写信"]').trigger('click');await flushPromises()
  expect(w.emitted('close')).toBeUndefined();expect(api.queue).not.toHaveBeenCalled();expect(w.text()).toContain('草稿保存失败')
 })
 it('supports sending via Cmd/Ctrl + Enter shortcut', async () => {
  const w = mountComposer(); await flushPromises()
  await w.get('input[aria-label="收件人"]').setValue('a@example.test')
  await w.get('textarea').setValue('Shortcut body')
  await w.get('textarea').trigger('keydown', { key: 'Enter', metaKey: true })
  await flushPromises()
  expect(api.queue).toHaveBeenCalledTimes(1)
  expect(w.emitted('queued')).toHaveLength(1)
 })
 it('supports drag and drop file attachments', async () => {
  api.upload.mockResolvedValue({ id: 'att-1', name: 'document.pdf', size: 1024, content_type: 'application/pdf' })
  const w = mountComposer(); await flushPromises()
  const file = new File(['mock content'], 'document.pdf', { type: 'application/pdf' })
  const dropEvent = { dataTransfer: { files: [file] } }
  await w.get('form').trigger('drop', dropEvent)
  await flushPromises()
  expect(api.upload).toHaveBeenCalledWith(file)
  expect(w.text()).toContain('document.pdf')
 })
})
