import {afterEach,describe,expect,it,vi} from 'vitest'
import {flushPromises,mount} from '@vue/test-utils'
import PaperFigureTools from '@/components/papers/PaperFigureTools.vue'
import {getPaperFile,type PaperFile} from '@/api/papers'

vi.mock('@/api/papers',()=>({getPaperFile:vi.fn()}))
vi.mock('@/components/papers/PaperAssetPreview.vue',()=>({default:{props:['file'],template:'<div data-test="figure-preview">{{ file.path }}</div>'}}))
const file=(id:string,path:string,revision=1):PaperFile=>({id,path,revision,kind:'binary',content:btoa(String.fromCharCode(137,80,78,71,13,10,26,10)),sha256:'',created_at:'',updated_at:''})
const a=file('a','figures/a.png'), b=file('b','figures/b.png')
const buttons=(wrapper:ReturnType<typeof mount>,label:string)=>wrapper.findAll('button').find(button=>button.text()===label)!
afterEach(()=>vi.clearAllMocks())
describe('Papers figure panel',()=>{
 it('loads one resource, previews without leaving the editor, and emits the revision-bound code',async()=>{
  vi.mocked(getPaperFile).mockResolvedValue(a)
  const wrapper=mount(PaperFigureTools,{props:{projectId:'p',files:[a,b],disabled:false,canInsert:true}})
  try{
   await flushPromises()
   expect(getPaperFile).toHaveBeenCalledTimes(1)
   await buttons(wrapper,'预览资源').trigger('click')
   expect(wrapper.get('[data-test="figure-preview"]').text()).toBe(a.path)
   await wrapper.get('[aria-label="图片宽度百分比"]').setValue(65)
   await wrapper.get('[aria-label="图片图注"]').setValue('Accuracy 95%')
   await wrapper.get('[aria-label="图片引用标签"]').setValue('fig:accuracy')
   await buttons(wrapper,'插入到光标处').trigger('click')
   const emitted=wrapper.emitted('insert')?.[0]?.[0]
   expect(emitted).toEqual({id:'a',path:a.path,revision:1,code:expect.stringContaining(String.raw`\includegraphics[width=0.65\linewidth]{figures/a.png}`)})
   expect((emitted as {code:string}).code).toContain(String.raw`\caption{Accuracy 95\%}`)
  }finally{wrapper.unmount()}
 })
 it('ignores stale resource responses and prevents insertion from a non-TeX source',async()=>{
  let resolveA!:(value:PaperFile)=>void
  vi.mocked(getPaperFile).mockImplementation(async(_pid,id)=>id==='a'?new Promise<PaperFile>(r=>{resolveA=r}):b)
  const wrapper=mount(PaperFigureTools,{props:{projectId:'p',files:[a,b],disabled:false,canInsert:false}})
  try{
   await wrapper.get('select[aria-label="插图文件"]').setValue('b')
   await flushPromises()
   resolveA(a);await flushPromises()
   expect(buttons(wrapper,'插入到光标处').attributes('disabled')).toBeDefined()
   await wrapper.setProps({canInsert:true})
   await buttons(wrapper,'插入到光标处').trigger('click')
   expect(wrapper.emitted('insert')?.[0]?.[0]).toMatchObject({id:'b',path:b.path})
  }finally{wrapper.unmount()}
 })
 it('does not insert a disguised image or an outdated file revision',async()=>{
  vi.mocked(getPaperFile).mockResolvedValue({...a,revision:2})
  const wrapper=mount(PaperFigureTools,{props:{projectId:'p',files:[a],disabled:false,canInsert:true}})
  try{
   await flushPromises()
   expect(wrapper.text()).toContain('资源版本已变化')
   expect(buttons(wrapper,'插入到光标处').attributes('disabled')).toBeDefined()
   vi.mocked(getPaperFile).mockResolvedValue({...a,revision:2,content:btoa('<html>')})
   await wrapper.setProps({files:[{...a,revision:2}]})
   await flushPromises()
   expect(wrapper.text()).toContain('不是可识别')
   expect(wrapper.emitted('insert')).toBeUndefined()
  }finally{wrapper.unmount()}
 })
})
