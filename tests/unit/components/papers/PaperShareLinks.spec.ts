import {describe,it,expect,vi,beforeEach} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import PaperShareLinks from '@/components/papers/PaperShareLinks.vue'
import {createPaperInvitation,listPaperInvitations,revokePaperInvitation} from '@/api/papers'

vi.mock('@/api/papers',()=>({createPaperInvitation:vi.fn(),listPaperInvitations:vi.fn(),revokePaperInvitation:vi.fn()}))

describe('owner invitation links',()=>{
 const token='A'.repeat(43)
 const row={id:'invitation-id',role:'editor' as const,created_at:'2026-11-26T00:00:00Z',expires_at:'2026-12-03T00:00:00Z'}
 beforeEach(()=>{
  vi.resetAllMocks()
  vi.mocked(listPaperInvitations).mockResolvedValue([])
  vi.mocked(createPaperInvitation).mockResolvedValue({...row,token})
  vi.mocked(revokePaperInvitation).mockResolvedValue({revoked:true})
 })
 it('creates the selected permission link, uses a fragment, and revokes it',async()=>{
  const w=mount(PaperShareLinks,{props:{projectId:'project-a',accountId:'owner-a',disabled:false}})
  await flushPromises()
  await w.get('[aria-label="链接权限"]').setValue('editor')
  await w.findAll('button').find(b=>b.text()==='生成邀请链接')!.trigger('click')
  await flushPromises()
  expect(createPaperInvitation).toHaveBeenCalledWith('project-a','editor')
  const url=new URL((w.get('[aria-label="新建邀请链接"]').element as HTMLInputElement).value)
  expect(url.pathname).toBe('/papers/invite')
  expect(url.hash).toBe('#'+token)
  expect(url.search).toBe('')
  await w.findAll('button').find(b=>b.text()==='撤销链接')!.trigger('click')
  await flushPromises()
  expect(revokePaperInvitation).toHaveBeenCalledWith('project-a',row.id)
  expect(w.find('[aria-label="新建邀请链接"]').exists()).toBe(false)
  w.unmount()
 })
 it('discards a late response when the project or account changes',async()=>{
  let resolve!:(value:Awaited<ReturnType<typeof createPaperInvitation>>)=>void
  vi.mocked(createPaperInvitation).mockImplementation(()=>new Promise(r=>{resolve=r}))
  const w=mount(PaperShareLinks,{props:{projectId:'project-a',accountId:'owner-a',disabled:false}})
  await flushPromises()
  await w.findAll('button').find(b=>b.text()==='生成邀请链接')!.trigger('click')
  await w.setProps({projectId:'project-b',accountId:'owner-b'})
  await flushPromises()
  resolve({...row,token})
  await flushPromises()
  expect(w.find('[aria-label="新建邀请链接"]').exists()).toBe(false)
  expect(listPaperInvitations).toHaveBeenCalledWith('project-b')
  w.unmount()
 })
})
