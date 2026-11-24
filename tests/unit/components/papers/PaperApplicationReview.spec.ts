import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaperApplicationReview from '@/components/papers/PaperApplicationReview.vue'
import { listPaperApplications, reviewPaperApplication } from '@/api/papers'
vi.mock('@/api/papers',()=>({listPaperApplications:vi.fn(),reviewPaperApplication:vi.fn()}))
const row = { id:'fixture-application',user_id:'fixture-user',username:'Applicant',reason:'Research paper writing',status:'pending' as const,review_note:'',created_at:'2026-11-24T00:00:00Z',notification_status:'' as const }
describe('Papers review workflow',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.mocked(listPaperApplications).mockResolvedValue([row])})
 it('approves only the selected pending application and refreshes the list',async()=>{
  vi.mocked(reviewPaperApplication).mockResolvedValue({...row,status:'approved',notification_status:'pending'})
  const w=mount(PaperApplicationReview);await flushPromises()
  expect(w.text()).toContain('Applicant')
  const approve=w.findAll('button').find(b=>b.text()==='通过并通知')
  expect(approve).toBeTruthy()
  await approve!.trigger('click');await flushPromises()
  expect(reviewPaperApplication).toHaveBeenCalledWith(row.id,'approved','')
  expect(listPaperApplications).toHaveBeenCalledTimes(2)
  w.unmount()
 })
 it('requires a reason for rejection',async()=>{
  const w=mount(PaperApplicationReview);await flushPromises()
  const reject=w.findAll('button').find(b=>b.text()==='拒绝')
  expect(reject?.attributes('disabled')).toBeDefined()
  await w.find('textarea').setValue('审核意见')
  expect(reject?.attributes('disabled')).toBeUndefined()
  vi.mocked(reviewPaperApplication).mockResolvedValue({...row,status:'rejected',review_note:'审核意见'})
  await reject!.trigger('click');await flushPromises()
  expect(reviewPaperApplication).toHaveBeenCalledWith(row.id,'rejected','审核意见')
  w.unmount()
 })
})
