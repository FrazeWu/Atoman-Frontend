import {mount,flushPromises} from '@vue/test-utils'
import {describe,it,expect,vi,beforeEach} from 'vitest'
import PaperCompileHistory from '@/components/papers/PaperCompileHistory.vue'
import {listPaperCompileJobs,type PaperCompileJob} from '@/api/papers'
import {compileDiagnosticHint,compileDuration,compileReport} from '@/components/papers/compileDiagnostics'

vi.mock('@/api/papers',()=>({listPaperCompileJobs:vi.fn()}))
const make=(id:string,status:PaperCompileJob['status'],rev:number,project='project'):PaperCompileJob=>({
 id,project_id:project,status,source_revision:rev,compiler:'xelatex',attempts:1,max_attempts:2,cancel_requested:false,created_at:rev===2?'2026-11-28T02:00:00Z':'2026-11-28T01:00:00Z',started_at:'2026-11-28T02:00:00Z',finished_at:'2026-11-28T02:01:12Z',
 ...(status==='failed'?{failure_code:'compile_failed',diagnostics:[{tool:'latex',file:'main.tex',line:4,message:'Undefined control sequence.'}]}:{})
})
beforeEach(()=>{vi.mocked(listPaperCompileJobs).mockReset()})
describe('Papers compilation history',()=>{
 it('keeps live job and preview identities, filters history and copies only diagnostics',async()=>{
  const recent=make('recent','running',2),old=make('old','failed',1),success=make('preview','succeeded',1)
  vi.mocked(listPaperCompileJobs).mockResolvedValue([make('recent','queued',2),old,success,make('foreign','failed',1,'other')])
  const copy=vi.fn().mockResolvedValue(undefined)
  const original=Object.getOwnPropertyDescriptor(navigator,'clipboard')
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}})
  const wrapper=mount(PaperCompileHistory,{props:{projectId:'project',accountId:'owner',revision:2,currentJob:recent,previewJobId:'preview'}})
  try{
   await flushPromises()
   expect(wrapper.findAll('.compile-history__job')).toHaveLength(3)
   expect(wrapper.text()).toContain('当前任务')
   expect(wrapper.text()).toContain('正在预览')
   expect(wrapper.text()).toContain('编译中')
   expect(wrapper.text()).not.toContain('排队中')
   await wrapper.findAll('button').find(b=>b.text()==='失败 (1)')!.trigger('click')
   expect(wrapper.findAll('.compile-history__job')).toHaveLength(1)
   expect(wrapper.text()).toContain('此记录对应历史源码版本')
   expect(wrapper.text()).toContain('Undefined control sequence.')
   expect(wrapper.text()).toContain('检查命令拼写')
   await wrapper.findAll('button').find(b=>b.text()==='复制诊断')!.trigger('click')
   await flushPromises()
   expect(copy).toHaveBeenCalledWith(compileReport(old))
   expect(copy.mock.calls[0][0]).toContain('main.tex:4')
   expect(copy.mock.calls[0][0]).not.toContain('foreign')
   await wrapper.setProps({currentJob:{...recent,status:'succeeded'}})
   await wrapper.findAll('button').find(b=>b.text()==='成功 (2)')!.trigger('click')
   expect(wrapper.findAll('.compile-history__job')).toHaveLength(2)
  }finally{wrapper.unmount();if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard')}
 })
 it('drops late responses across project changes and clears history on failure',async()=>{
  let resolve!:(rows:PaperCompileJob[])=>void
  vi.mocked(listPaperCompileJobs).mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValueOnce([make('new','succeeded',2,'new')]).mockRejectedValueOnce(new Error('offline'))
  const wrapper=mount(PaperCompileHistory,{props:{projectId:'project',accountId:'owner',revision:1,currentJob:null}})
  try{
   await wrapper.setProps({projectId:'new',accountId:'other',revision:2})
   await flushPromises()
   resolve([make('old','failed',1)]);await flushPromises()
   expect(wrapper.findAll('.compile-history__job')).toHaveLength(1)
   expect(wrapper.text()).not.toContain('Undefined control sequence.')
   await wrapper.findAll('button').find(b=>b.text()==='刷新记录')!.trigger('click');await flushPromises()
   expect(wrapper.findAll('.compile-history__job')).toHaveLength(0)
   expect(wrapper.text()).toContain('无法读取编译历史')
  }finally{wrapper.unmount()}
 })
 it('formats valid elapsed time and gives only bounded local guidance',()=>{
  const job=make('a','failed',1)
  expect(compileDuration(job)).toBe('1 分 12 秒')
  expect(compileDuration({...job,finished_at:'invalid'})).toBe('—')
  expect(compileDiagnosticHint({tool:'latex',message:'Missing $ inserted.'})).toContain('数学模式')
  expect(compileDiagnosticHint({tool:'latex',message:'Runaway argument?'})).toContain('花括号')
  expect(compileDiagnosticHint({tool:'latex',message:'Unrecognized diagnostic'})).toBe('')
  expect(compileReport({...job,diagnostics:Array.from({length:20},()=>job.diagnostics![0]!)}).split('\n').filter(r=>r.includes('Undefined control sequence'))).toHaveLength(12)
 })
})
