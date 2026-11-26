import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h, nextTick } from 'vue'
import {listLocalDrafts,writeLocalDraft,setLocalDraftEnabled,type PaperLocalDraft} from '@/components/papers/localDrafts'
import LatexEditor from "@/components/papers/LatexEditor.vue"
import PaperWorkspaceView from '@/views/papers/PaperWorkspaceView.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { ApiErrorResponseError } from '@/api/client'
import {getPaperCollaborationCapability,listPaperMembers,setPaperMember,removePaperMember,listPaperProjectSnapshots,getPaperProjectSnapshot,createPaperProjectSnapshot,restorePaperProjectSnapshot,deletePaperProjectSnapshot, managePaperFiles, savePaperFile, getPaperFile, getPaperProject, listPaperFiles, getPaperCompileCapability, listPaperCompileJobs, submitPaperCompile, cancelPaperCompile, listPaperFileVersions, getPaperFileVersion } from '@/api/papers'

vi.mock('@/stores/auth',()=>({useAuthStore:()=>({isAuthenticated:true,user:{uuid:'owner-a'}})}))
vi.mock('@/api/papers', () => ({
  getPaperCollaborationCapability:vi.fn().mockResolvedValue({enabled:false}),
  listPaperMembers:vi.fn(),setPaperMember:vi.fn(),removePaperMember:vi.fn(),
  listPaperProjectSnapshots:vi.fn(),
  getPaperProjectSnapshot:vi.fn(),
  createPaperProjectSnapshot:vi.fn(),
  restorePaperProjectSnapshot:vi.fn(),
  deletePaperProjectSnapshot:vi.fn(),
  getPaperProject: vi.fn(),
  listPaperFiles: vi.fn(),
  getPaperFile: vi.fn(),
  savePaperFile: vi.fn(),
  createPaperFile: vi.fn(),
  managePaperFiles: vi.fn(),
  listPaperFileVersions: vi.fn(),
  getPaperFileVersion: vi.fn(),
  getPaperProjectZIP: vi.fn(),
  downloadPaperZIP: vi.fn(),
  getPaperCompileCapability: vi.fn().mockResolvedValue({ enabled: false, pdf_available: false }),
  listPaperCompileJobs: vi.fn().mockResolvedValue([]),
  submitPaperCompile: vi.fn(),
  getPaperCompileJob: vi.fn(),
  getPaperCompileSourceMap: vi.fn().mockResolvedValue(null),
  cancelPaperCompile: vi.fn(),
}))
const jumpLine=vi.hoisted(()=>vi.fn())
const jumpMatch=vi.hoisted(()=>vi.fn())
const insertBlock=vi.hoisted(()=>vi.fn(()=>true))
vi.mock('@/components/papers/LatexEditor.vue', () => ({
  default: { props: ['modelValue','readonly'], emits:['update:modelValue','show-pdf'], methods:{goToLine:jumpLine,goToMatch:jumpMatch,getLine:()=>1,insertBlock}, template: '<pre data-test="editor" :data-readonly="String(readonly)">{{ modelValue }}</pre>' },
}))

vi.mock('@/components/papers/PaperPDFPreview.vue', () => ({
  default: { props: ['projectId', 'jobId', 'revision'], template: '<div data-test="paper-pdf-preview">{{ projectId }}:{{ jobId }}:{{ revision }}</div>' },
}))

const one = { id: 'one', name: 'Old project', main_file_id: 'f1', head_revision: 1 }
const two = { id: 'two', name: 'Current project', main_file_id: 'f2', head_revision: 1 }
const f1 = { id: 'f1', path: 'old.tex', kind: 'text', revision: 1, content: 'Old source', sha256: '' }
const f2 = { id: 'f2', path: 'main.tex', kind: 'text', revision: 1, content: 'Current source', sha256: '' }

afterEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPaperCollaborationCapability).mockReset().mockResolvedValue({enabled:false})
  vi.mocked(getPaperCompileCapability).mockResolvedValue({ enabled: false, pdf_available: false })
  vi.mocked(listPaperCompileJobs).mockResolvedValue([])
})

describe('Papers workspace load sequencing', () => {
  it('cannot show stale project or file results after route changes', async () => {
    let releaseOld: ((files: typeof f1[]) => void) | undefined
    const oldFiles = new Promise<typeof f1[]>((resolve) => { releaseOld = resolve })
    vi.mocked(getPaperProject).mockImplementation(async id => (id === 'one' ? one : two) as never)
    vi.mocked(listPaperFiles).mockImplementation(async id => id === 'one' ? oldFiles : [f2])
    vi.mocked(getPaperFile).mockImplementation(async (id) => (id === 'one' ? f1 : f2) as never)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/papers/:projectId', component: PaperWorkspaceView },
        { path: '/papers', component: { template: '<div />' } },
      ],
    })
    await router.push('/papers/one')
    await router.isReady()
    const wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
      global: { plugins: [router] },
    })
    try {
      await nextTick()
      expect(getPaperProject).toHaveBeenCalledWith('one')
      await router.push('/papers/two')
      await flushPromises()
      releaseOld?.([f1])
      await flushPromises()
      expect(wrapper.text()).toContain('Current project')
      expect(wrapper.text()).toContain('Current source')
      expect(wrapper.text()).not.toContain('Old project')
      expect(wrapper.text()).not.toContain('Old source')
    } finally {
      wrapper.unmount()
    }
  })
})


describe('Papers compile availability and task workflow', () => {
  it('keeps compilation disabled without reviewed backend capability', async () => {
    vi.mocked(getPaperProject).mockResolvedValue(two as never)
    vi.mocked(listPaperFiles).mockResolvedValue([f2] as never)
    vi.mocked(getPaperFile).mockResolvedValue(f2 as never)
    vi.mocked(getPaperCompileCapability).mockResolvedValue({ enabled: false, pdf_available: false })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/papers/:projectId', component: PaperWorkspaceView }, { path: '/papers', component: { template: '<div />' } }],
    })
    await router.push('/papers/two')
    await router.isReady()
    const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } })
    try {
      await flushPromises()
      const compile = wrapper.findAll('button').find(button => button.text() === '编译')
      expect(compile?.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('编译尚未开放')
      expect(submitPaperCompile).not.toHaveBeenCalled()
      expect(listPaperCompileJobs).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('submits saved revision and cancels an owned queued task', async () => {
    const queued = {
      id: 'job-1', project_id: 'two', source_revision: 1, status: 'queued',
      attempts: 0, max_attempts: 2, cancel_requested: false, created_at: '2026-10-28T00:00:00Z',
    }
    vi.mocked(getPaperProject).mockResolvedValue(two as never)
    vi.mocked(listPaperFiles).mockResolvedValue([f2] as never)
    vi.mocked(getPaperFile).mockResolvedValue(f2 as never)
    vi.mocked(getPaperCompileCapability).mockResolvedValue({ enabled: true, pdf_available: false })
    vi.mocked(listPaperCompileJobs).mockResolvedValue([])
    vi.mocked(submitPaperCompile).mockResolvedValue(queued as never)
    vi.mocked(cancelPaperCompile).mockResolvedValue({ ...queued, status: 'canceled', cancel_requested: true } as never)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/papers/:projectId', component: PaperWorkspaceView }, { path: '/papers', component: { template: '<div />' } }],
    })
    await router.push('/papers/two')
    await router.isReady()
    const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } })
    try {
      await flushPromises()
      const compile = wrapper.findAll('button').find(button => button.text() === '编译')
      expect(compile?.attributes('disabled')).toBeUndefined()
      await compile?.trigger('click')
      await flushPromises()
      expect(submitPaperCompile).toHaveBeenCalledTimes(1)
      expect(vi.mocked(submitPaperCompile).mock.calls[0]?.slice(0, 2)).toEqual(['two', 1])
      expect(wrapper.text()).toContain('排队中')
      const cancel = wrapper.findAll('button').find(button => button.text() === '取消任务')
      await cancel?.trigger('click')
      await flushPromises()
      expect(cancelPaperCompile).toHaveBeenCalledWith('two', 'job-1')
      expect(wrapper.text()).toContain('已取消')
      expect(wrapper.html()).not.toContain('main.pdf')
    } finally {
      wrapper.unmount()
    }
  })
})

describe('Verified PDF result preview', () => {
  it.each([
    { enabled: true, pdfAvailable: true, jobAvailable: true, status: 'succeeded', visible: true },
    { enabled: true, pdfAvailable: false, jobAvailable: true, status: 'succeeded', visible: false },
    { enabled: true, pdfAvailable: true, jobAvailable: false, status: 'succeeded', visible: false },
    { enabled: true, pdfAvailable: true, jobAvailable: true, status: 'failed', visible: false },
    { enabled: false, pdfAvailable: true, jobAvailable: true, status: 'succeeded', visible: false },
  ])('requires server capability and a verified successful result ($status, $visible)', async ({ enabled, pdfAvailable, jobAvailable, status, visible }) => {
    vi.mocked(getPaperProject).mockResolvedValue(two as never)
    vi.mocked(listPaperFiles).mockResolvedValue([f2] as never)
    vi.mocked(getPaperFile).mockResolvedValue(f2 as never)
    vi.mocked(getPaperCompileCapability).mockResolvedValue({ enabled, pdf_available: pdfAvailable })
    vi.mocked(listPaperCompileJobs).mockResolvedValue([{
      id: 'verified-job', project_id: 'two', source_revision: 1, status,
      attempts: 1, max_attempts: 2, cancel_requested: false, pdf_available: jobAvailable,
      created_at: '2026-11-24T00:00:00Z',
    }] as never)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/papers/:projectId', component: PaperWorkspaceView }, { path: '/papers', component: { template: '<div />' } }],
    })
    await router.push('/papers/two')
    await router.isReady()
    const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [router] } })
    try {
      await flushPromises()
      const preview = wrapper.find('[data-test="paper-pdf-preview"]')
      expect(preview.exists()).toBe(visible)
      if (visible) expect(preview.text()).toBe('two:verified-job:1')
    } finally {
      wrapper.unmount()
    }
  })
})

describe('Papers save and transition regression',()=>{
 const chapter={...f2,id:'chapter',path:'chapters/intro.tex',content:'Chapter original'}
 const appendix={...f2,id:'appendix',path:'appendix.tex',content:'Appendix original'}
 async function open(){
   vi.mocked(getPaperProject).mockImplementation(async()=>({...two}) as never)
   vi.mocked(listPaperFiles).mockResolvedValue([f2,chapter,appendix] as never)
   vi.mocked(getPaperFile).mockImplementation(async(_pid,id)=>({...([f2,chapter,appendix].find(f=>f.id===id)||f2)}) as never)
   const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView},{path:'/papers',component:{template:'<div>Project list</div>'}}]})
   await router.push('/papers/two');await router.isReady()
   const wrapper=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
   await flushPromises()
   return {wrapper,router}
 }
 it('drains both edits before switching, with one in-flight save and the latest file choice',async()=>{
  let resolveFirst:(value:unknown)=>void=()=>{}
  let resolveSecond:(value:unknown)=>void=()=>{}
  vi.mocked(savePaperFile).mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve as never})).mockImplementationOnce(()=>new Promise(resolve=>{resolveSecond=resolve as never}))
  const {wrapper}=await open()
  try{
   wrapper.findComponent(LatexEditor).vm.$emit('update:modelValue','First edit')
   await nextTick()
   await wrapper.findAll('button').find(b=>b.text()==='保存')!.trigger('click')
   expect(savePaperFile).toHaveBeenNthCalledWith(1,'two','f2','First edit',1)
   wrapper.findComponent(LatexEditor).vm.$emit('update:modelValue','Latest edit')
   await nextTick()
   await wrapper.findAll('button').find(b=>b.attributes('title')==='chapters/intro.tex')!.trigger('click')
   await wrapper.findAll('button').find(b=>b.attributes('title')==='appendix.tex')!.trigger('click')
   await flushPromises()
   expect(wrapper.find('[data-test="editor"]').text()).toBe('Latest edit')
   expect(wrapper.find('[data-test="editor"]').attributes('data-readonly')).toBe('true')
   expect(savePaperFile).toHaveBeenCalledTimes(1)
   resolveFirst({...f2,content:'First edit',revision:2,project_head_revision:2})
   await flushPromises()
   expect(savePaperFile).toHaveBeenNthCalledWith(2,'two','f2','Latest edit',2)
   expect(wrapper.find('[data-test="editor"]').text()).toBe('Latest edit')
   resolveSecond({...f2,content:'Latest edit',revision:3,project_head_revision:3})
   await flushPromises()
   expect(wrapper.find('[data-test="editor"]').text()).toBe('Appendix original')
   expect(wrapper.find('[data-test="editor"]').attributes('data-readonly')).toBe('false')
   expect(savePaperFile).toHaveBeenCalledTimes(2)
   expect(getPaperFile).not.toHaveBeenCalledWith('two','chapter')
  }finally{wrapper.unmount()}
 })
 it('keeps the local draft and refuses route exit when saving fails',async()=>{
  vi.mocked(savePaperFile).mockRejectedValueOnce(new Error('network'))
  const {wrapper,router}=await open()
  try{
   wrapper.findComponent(LatexEditor).vm.$emit('update:modelValue','Unsaved text')
   await nextTick()
   await router.push('/papers')
   await flushPromises()
   expect(router.currentRoute.value.path).toBe('/papers/two')
   expect(wrapper.find('[data-test="editor"]').text()).toBe('Unsaved text')
   expect(wrapper.text()).toContain('当前输入已保留')
   expect(wrapper.find('[data-test="editor"]').attributes('data-readonly')).toBe('false')
   vi.mocked(savePaperFile).mockResolvedValueOnce({...f2,content:'Unsaved text',revision:2,project_head_revision:2} as never)
   await router.push('/papers')
   await flushPromises()
   expect(router.currentRoute.value.path).toBe('/papers')
  }finally{wrapper.unmount()}
 })
 it('places running status and cancellation inside the central PDF toolbar',async()=>{
  vi.mocked(getPaperCompileCapability).mockResolvedValue({enabled:true,pdf_available:true})
  vi.mocked(listPaperCompileJobs).mockResolvedValue([
   {id:'running',project_id:'two',source_revision:1,status:'running',attempts:1,max_attempts:2,cancel_requested:false},
   {id:'old',project_id:'two',source_revision:1,status:'succeeded',pdf_available:true,attempts:1,max_attempts:2,cancel_requested:false}
  ] as never)
  const {wrapper}=await open()
  try{
   const toolbar=wrapper.find('.papers-workspace__preview-heading')
   expect(toolbar.find('.papers-workspace__compile-status').text()).toContain('编译中')
   expect(toolbar.find('.papers-workspace__compile-status').text()).toContain('预览为上次成功版本')
   expect(toolbar.find('.papers-workspace__compile-status').text()).toContain('取消任务')
  }finally{wrapper.unmount()}
 })
 it('navigates a diagnostic to its exact file and line and disables stale locations',async()=>{
  vi.mocked(getPaperCompileCapability).mockResolvedValue({enabled:true,pdf_available:true})
  vi.mocked(listPaperCompileJobs).mockResolvedValue([{
   id:'failed',project_id:'two',source_revision:1,status:'failed',failure_code:'compile_failed',attempts:1,max_attempts:2,cancel_requested:false,
   diagnostics:[{tool:'latex',file:'chapters/intro.tex',line:2,message:'Undefined control sequence.'}]
  }] as never)
  const {wrapper}=await open()
  try{
   expect(wrapper.text()).toContain('Undefined control sequence.')
   await wrapper.find('.papers-workspace__diagnostic-location').trigger('click')
   await flushPromises()
   expect(wrapper.find('[data-test="editor"]').text()).toBe('Chapter original')
   expect(jumpLine).toHaveBeenCalledWith(2)
   wrapper.findComponent(LatexEditor).vm.$emit('update:modelValue','Changed source')
   await nextTick()
   expect(wrapper.find('.papers-workspace__diagnostic-location').attributes('disabled')).toBeDefined()
  }finally{wrapper.unmount()}
 })
})

describe('Papers file management actions',()=>{
 it('collapses a directory and uses a revision-checked rename without replacing the draft',async()=>{
  const chapter={...f2,id:'chapter',path:'chapters/intro.tex',content:'Chapter'}
  vi.mocked(getPaperProject).mockResolvedValue({...two} as never)
  vi.mocked(listPaperFiles).mockResolvedValue([f2,chapter] as never)
  vi.mocked(getPaperFile).mockImplementation(async(_id,fid)=>(fid==='chapter'?chapter:f2) as never)
  vi.mocked(managePaperFiles).mockResolvedValue({project:{...two,head_revision:2},files:[f2,{...chapter,path:'chapters/method.tex',revision:2}]} as never)
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView}]})
  await router.push('/papers/two');await router.isReady()
  const w=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})

  try{
   await flushPromises()
   const folder=w.find('.papers-workspace__folder')
   expect(folder.text()).toContain('chapters')
   await folder.trigger('click')
   expect(w.find('[title="chapters/intro.tex"]').exists()).toBe(false)
   await folder.trigger('click')
   await w.find('[aria-label="管理 chapters/intro.tex"]').trigger('click')
   await w.get('input[aria-label="文件新路径"]').setValue('chapters/method.tex')
   await w.findAll('button').find(b=>b.text()==='重命名 / 移动')!.trigger('click'); await w.getComponent(PConfirm).vm.$emit('confirm')
   await flushPromises()
   expect(managePaperFiles).toHaveBeenCalledWith('two',{action:'rename',file_id:'chapter',path:'chapters/method.tex',base_revision:1})
   expect(w.find('[title="chapters/method.tex"]').exists()).toBe(true)
   expect(w.find('[data-test="editor"]').text()).toBe('Current source')
  }finally{vi.unstubAllGlobals();w.unmount()}
 })
})

describe('Papers phase two workspace tools', () => {
  async function workspace(){
    vi.mocked(getPaperProject).mockResolvedValue({...two} as never)
    vi.mocked(listPaperFiles).mockResolvedValue([{...f2}] as never)
    vi.mocked(getPaperFile).mockResolvedValue({...f2} as never)
    const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView},{path:'/papers',component:{template:'<div />'}}]})
    await router.push('/papers/two');await router.isReady()
    const wrapper=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
    await flushPromises()
    return wrapper
  }
  it('finds project text and jumps to the saved line', async()=>{
    const wrapper=await workspace()
    try{
      await wrapper.findAll('button').find(b=>b.text()==='全项目搜索')!.trigger('click')
      await flushPromises()
      await wrapper.find('input[placeholder="输入源码或关键字"]').setValue('source')
      expect(wrapper.text()).toContain('1 处匹配')
      const hit=wrapper.findAll('button').find(b=>b.text().includes('main.tex:1:9'))!
      await hit.trigger('click');await flushPromises()
      expect(jumpMatch).toHaveBeenCalledWith(1,9,6)
    }finally{wrapper.unmount()}
  })
  it('previews saved history with original source and compares against the current file', async()=>{
    vi.mocked(listPaperFileVersions).mockResolvedValue([{revision:1,path:'main.tex',sha256:'',created_at:'2026-11-24T00:00:00Z'}])
    vi.mocked(getPaperFileVersion).mockResolvedValue({file_id:'f2',revision:1,path:'main.tex',sha256:'',content:'Old text',created_at:'2026-11-24T00:00:00Z'})
    const wrapper=await workspace()
    try{
      await wrapper.findAll('button').find(b=>b.text()==='版本历史')!.trigger('click');await flushPromises()
      expect(listPaperFileVersions).toHaveBeenCalledWith('two','f2',undefined)
      await wrapper.findAll('button').find(b=>b.text().includes('版本 1 · 当前'))!.trigger('click');await flushPromises()
      expect(wrapper.findAll('textarea').map(t=>(t.element as HTMLTextAreaElement).value)).toEqual(['Old text','Current source'])
      expect(wrapper.text()).toContain('差异范围')
    }finally{wrapper.unmount()}
  })

  it('applies confirmed project replacements as one revision-bound operation', async()=>{
    const wrapper=await workspace()

    const updated={...f2,revision:2,content:'Current text'}
    vi.mocked(managePaperFiles).mockImplementation(async()=>{
      vi.mocked(getPaperFile).mockResolvedValue(updated as never)
      return {project:{...two,head_revision:2},files:[updated]} as never
    })
    try{
      await wrapper.findAll('button').find(b=>b.text()==='全项目搜索')!.trigger('click');await flushPromises()
      await wrapper.get('input[placeholder="输入源码或关键字"]').setValue('source')
      await wrapper.get('input[placeholder="留空表示删除匹配文字"]').setValue('text')
      await wrapper.findAll('button').find(b=>b.text()==='全部替换')!.trigger('click')
      expect(managePaperFiles).not.toHaveBeenCalled()
      expect(wrapper.getComponent(PConfirm).props('show')).toBe(true)
      wrapper.getComponent(PConfirm).vm.$emit('cancel');await flushPromises()
      expect(managePaperFiles).not.toHaveBeenCalled()
      await wrapper.findAll('button').find(b=>b.text()==='全部替换')!.trigger('click');wrapper.getComponent(PConfirm).vm.$emit('confirm');await flushPromises()
      expect(managePaperFiles).toHaveBeenCalledWith('two',{action:'replace_text',base_revision:1,replacements:[{file_id:'f2',base_revision:1,content:'Current text'}]})
      expect(wrapper.find('[data-test="editor"]').text()).toBe('Current text')
    }finally{vi.unstubAllGlobals();wrapper.unmount()}
  })
  it('restores a historical source by writing a new revision',async()=>{
    const wrapper=await workspace()

    vi.mocked(listPaperFileVersions).mockResolvedValue([{revision:1,path:'main.tex',sha256:'',created_at:'2026-11-24T00:00:00Z'}])
    vi.mocked(getPaperFileVersion).mockResolvedValue({file_id:'f2',revision:1,path:'main.tex',sha256:'',content:'Old text',created_at:'2026-11-24T00:00:00Z'})
    vi.mocked(savePaperFile).mockResolvedValue({...f2,revision:2,project_head_revision:2,content:'Old text'} as never)
    try{
      await wrapper.findAll('button').find(b=>b.text()==='版本历史')!.trigger('click');await flushPromises()
      await wrapper.findAll('button').find(b=>b.text().includes('版本 1 · 当前'))!.trigger('click');await flushPromises()
      await wrapper.findAll('button').find(b=>b.text()==='恢复源码为此版本')!.trigger('click'); await wrapper.getComponent(PConfirm).vm.$emit('confirm');await flushPromises()
      expect(savePaperFile).toHaveBeenCalledWith('two','f2','Old text',1)
      expect(wrapper.find('[data-test="editor"]').text()).toBe('Old text')
    }finally{vi.unstubAllGlobals();wrapper.unmount()}
  })
  it('retains a transiently unsaved draft and retries when connectivity returns',async()=>{
    const wrapper=await workspace()
    vi.mocked(savePaperFile).mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce({...f2,revision:2,project_head_revision:2,content:'Offline draft'} as never)
    try{
      wrapper.findComponent(LatexEditor).vm.$emit('update:modelValue','Offline draft')
      await nextTick()
      await wrapper.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises()
      expect(wrapper.text()).toContain('恢复连接后将尝试保存')
      expect(wrapper.find('[data-test="editor"]').text()).toBe('Offline draft')
      window.dispatchEvent(new Event('online'));await flushPromises()
      expect(savePaperFile).toHaveBeenCalledTimes(2)
      expect(wrapper.text()).not.toContain('恢复连接后将尝试保存')
      expect(wrapper.text()).toContain('已保存')
    }finally{wrapper.unmount()}
  })
})

describe('Papers compiler capability',()=>{
 async function openCompilerWorkspace(compilers?:('pdflatex'|'lualatex'|'xelatex')[]){
  vi.mocked(getPaperProject).mockResolvedValue({...two} as never)
  vi.mocked(listPaperFiles).mockResolvedValue([f2] as never)
  vi.mocked(getPaperFile).mockResolvedValue(f2 as never)
  vi.mocked(getPaperCompileCapability).mockResolvedValue({enabled:true,pdf_available:true,compilers})
  vi.mocked(listPaperCompileJobs).mockResolvedValue([])
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView}]})
  await router.push('/papers/two');await router.isReady()
  const wrapper=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
  await flushPromises()
  return wrapper
 }
 it('does not advertise unsupported compilers for a legacy server',async()=>{
  const wrapper=await openCompilerWorkspace()
  try{expect(wrapper.get('select[aria-label="TeX 编译器"]').findAll('option').map(o=>o.text())).toEqual(['pdfLaTeX'])}
  finally{wrapper.unmount()}
 })
 it('submits selected approved engine and prevents changes during an active job',async()=>{
  const wrapper=await openCompilerWorkspace(['pdflatex','lualatex'])
  vi.mocked(submitPaperCompile).mockResolvedValue({id:'lua-1',project_id:'two',source_revision:1,compiler:'lualatex',status:'queued',attempts:0,max_attempts:2,cancel_requested:false,created_at:'2026-11-25T00:00:00Z'} as never)
  try{
   const select=wrapper.get('select[aria-label="TeX 编译器"]')
   expect(select.findAll('option').map(o=>o.text())).toEqual(['pdfLaTeX','LuaLaTeX'])
   await select.setValue('lualatex')
   await wrapper.findAll('button').find(b=>b.text()==='编译')!.trigger('click');await flushPromises()
   expect(submitPaperCompile).toHaveBeenCalledWith('two',1,expect.any(String),'lualatex')
   expect(wrapper.find('.papers-workspace__compile-status').text()).toContain('LuaLaTeX')
   expect(select.attributes('disabled')).toBeDefined()
  }finally{wrapper.unmount()}
 })

 it('only exposes XeLaTeX when the backend advertises it and binds the submitted engine',async()=>{
  const wrapper=await openCompilerWorkspace(['pdflatex','xelatex'])
  vi.mocked(submitPaperCompile).mockResolvedValue({id:'xe-1',project_id:'two',source_revision:1,compiler:'xelatex',status:'queued',attempts:0,max_attempts:2,cancel_requested:false,created_at:'2026-11-25T00:00:00Z'} as never)
  try{
   const select=wrapper.get('select[aria-label="TeX 编译器"]')
   expect(select.findAll('option').map(o=>o.text())).toEqual(['pdfLaTeX','XeLaTeX'])
   await select.setValue('xelatex')
   await wrapper.findAll('button').find(b=>b.text()==='编译')!.trigger('click');await flushPromises()
   expect(submitPaperCompile).toHaveBeenCalledWith('two',1,expect.any(String),'xelatex')
   expect(wrapper.find('.papers-workspace__compile-status').text()).toContain('XeLaTeX')
   expect(select.attributes('disabled')).toBeDefined()
  }finally{wrapper.unmount()}
 })
})

describe('Papers image upload and insertion workflow',()=>{
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0])
 const img={id:'img',path:'figures/plot.png',kind:'binary' as const,revision:1,content:btoa(String.fromCharCode(...png)),sha256:'',created_at:'',updated_at:''}
 async function open(files: Array<typeof f2|typeof img>=[f2]){
  vi.mocked(getPaperProject).mockResolvedValue({...two} as never)
  vi.mocked(listPaperFiles).mockResolvedValue(files as never)
  vi.mocked(getPaperFile).mockImplementation(async(_pid,id)=>id===img.id?img:f2 as never)
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView}]})
  await router.push('/papers/two');await router.isReady()
  const wrapper=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
  await flushPromises()
  return wrapper
 }
 it('uploads dropped PNG files to the default figures directory without switching away from the source',async()=>{
  const wrapper=await open()
  const file={name:'plot.png',size:png.length,arrayBuffer:async()=>png.buffer} as File
  vi.mocked(managePaperFiles).mockResolvedValue({project:{...two,head_revision:2},files:[f2,img]} as never)
  try{
   const sidebar=wrapper.get('aside[aria-label="论文文件"]')
   await sidebar.trigger('dragover',{dataTransfer:{types:['Files'],files:[file],dropEffect:'none'}})
   expect(wrapper.text()).toContain('松开鼠标上传插图')
   await sidebar.trigger('drop',{dataTransfer:{types:['Files'],files:[file]}})
   await flushPromises()
   expect(managePaperFiles).toHaveBeenCalledWith('two',{action:'upload',base_revision:1,uploads:[{path:img.path,kind:'binary',content:img.content}]})
   expect(wrapper.get('[data-test="editor"]').text()).toBe('Current source')
   expect(wrapper.text()).toContain('plot.png')
   expect(wrapper.text()).not.toContain('松开鼠标上传插图')
  }finally{wrapper.unmount()}
 })
 it('blocks disguised graphic files before mutation',async()=>{
  const wrapper=await open()
  const raw=new TextEncoder().encode('<html>')
  const file={name:'fake.png',size:raw.length,arrayBuffer:async()=>raw.buffer} as File
  try{
   await wrapper.get('aside[aria-label="论文文件"]').trigger('drop',{dataTransfer:{types:['Files'],files:[file]}})
   await flushPromises()
   expect(managePaperFiles).not.toHaveBeenCalled()
   expect(wrapper.text()).toContain('无法识别')
  }finally{wrapper.unmount()}
 })
 it('inserts a selected project figure through the active editor without loading a different source',async()=>{
  const wrapper=await open([f2,img])
  try{
   await wrapper.findAll('button').find(b=>b.text()==='插图')!.trigger('click')
   await flushPromises()
   expect(wrapper.get('[aria-label="插图管理"]').text()).toContain(img.path)
   await wrapper.get('[aria-label="图片图注"]').setValue('Ablation results')
   await wrapper.findAll('button').find(b=>b.text()==='插入到光标处')!.trigger('click')
   expect(insertBlock).toHaveBeenCalledWith(expect.stringContaining(String.raw`\includegraphics[width=0.8\linewidth]{figures/plot.png}`))
   expect(wrapper.find('[aria-label="插图管理"]').exists()).toBe(false)
   expect(wrapper.get('[data-test="editor"]').text()).toBe('Current source')
  }finally{wrapper.unmount()}
 })
})

describe('Papers template compiler recommendation',()=>{
 async function openRecommended(compilers:('pdflatex'|'xelatex')[]){
  const main={...f2,content:'% !TEX program = xelatex\nChinese manuscript'}
  vi.mocked(getPaperProject).mockResolvedValue({...two} as never)
  vi.mocked(listPaperFiles).mockResolvedValue([main] as never)
  vi.mocked(getPaperFile).mockResolvedValue(main as never)
  vi.mocked(getPaperCompileCapability).mockResolvedValue({enabled:true,pdf_available:true,compilers})
  vi.mocked(listPaperCompileJobs).mockResolvedValue([])
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView}]})
  await router.push('/papers/two');await router.isReady()
  const w=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
  await flushPromises()
  return w
 }
 it('selects the recommended XeLaTeX compiler only if the server allows it',async()=>{
  const w=await openRecommended(['pdflatex','xelatex'])
  try{expect((w.get('select[aria-label="TeX 编译器"]').element as HTMLSelectElement).value).toBe('xelatex')}
  finally{w.unmount()}
 })
 it('shows an explicit recommendation when the compiler is not available and blocks automatic compilation',async()=>{
  const w=await openRecommended(['pdflatex'])
  try{
   expect(w.text()).toContain('源码建议使用 XeLaTeX，当前编译环境尚未开放此编译器')
   expect((w.get('select[aria-label="TeX 编译器"]').element as HTMLSelectElement).value).toBe('pdflatex')
   expect(w.get('.papers-workspace__auto input').attributes('disabled')).toBeDefined()
  }finally{w.unmount()}
 })
})

describe('Papers project recovery workflow',()=>{
 const checkpoint={id:'checkpoint-1',name:'Before submission',source_revision:1,main_file_id:'f2',file_count:1,source_bytes:14,automatic:false,created_at:'2026-11-25T00:00:00Z'}
 const details={...checkpoint,files:[{file_id:'f2',revision:1,path:'main.tex',kind:'text' as const,sha256:''}]}
 function storageFixture(){
  const rows=new Map<string,string>()
  const storage:Storage={get length(){return rows.size},key:i=>Array.from(rows.keys())[i]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>{rows.set(key,String(value))},removeItem:key=>{rows.delete(key)},clear:()=>rows.clear()}
  vi.stubGlobal('localStorage',storage)
  return storage
 }
 async function open(){
  vi.mocked(getPaperProject).mockResolvedValue({...two} as never)
  vi.mocked(listPaperFiles).mockResolvedValue([{...f2}] as never)
  vi.mocked(getPaperFile).mockResolvedValue({...f2} as never)
  vi.mocked(listPaperProjectSnapshots).mockResolvedValue([checkpoint])
  vi.mocked(getPaperProjectSnapshot).mockResolvedValue(details)
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView}]})
  await router.push('/papers/two');await router.isReady()
  const w=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
  await flushPromises()
  return w
 }
 it('creates a named project checkpoint and reloads restored content rather than retaining stale source',async()=>{
  const storage=storageFixture()

  const w=await open()
  try{
   await w.findAll('button').find(b=>b.text()==='项目快照')!.trigger('click')
   await flushPromises()
   await w.get('[aria-label="快照名称"]').setValue('Before camera-ready')
   vi.mocked(createPaperProjectSnapshot).mockResolvedValue({...checkpoint,name:'Before camera-ready'})
   await w.get('.paper-recovery__create').trigger('submit')
   await flushPromises()
   expect(createPaperProjectSnapshot).toHaveBeenCalledWith('two','Before camera-ready',1)
   await w.get('.paper-recovery__select').trigger('click');await flushPromises()
   expect(w.text()).toContain('main.tex')
   const restored={...f2,revision:2,content:'Restored source'}
   vi.mocked(restorePaperProjectSnapshot).mockResolvedValue({project:{...two,head_revision:2},files:[restored],backup:{...checkpoint,id:'backup',automatic:true}} as never)
   vi.mocked(getPaperFile).mockResolvedValue(restored as never)
   await w.findAll('button').find(b=>b.text()==='恢复整个项目')!.trigger('click'); await w.getComponent(PConfirm).vm.$emit('confirm');await flushPromises()
   expect(restorePaperProjectSnapshot).toHaveBeenCalledWith('two','checkpoint-1',1)
   expect(w.get('[data-test="editor"]').text()).toBe('Restored source')
   expect(w.text()).toContain('回滚前状态已自动保存')
   expect(savePaperFile).not.toHaveBeenCalled()
   expect(listLocalDrafts(storage,'owner-a','two')).toHaveLength(0)
  }finally{w.unmount();vi.unstubAllGlobals()}
 })
 it('keeps unsaved edits across reloads and clears only acknowledged compatible drafts',async()=>{
  const storage=storageFixture()
  let w=await open()

  try{
   await w.findAll('button').find(b=>b.text()==='草稿恢复')!.trigger('click')
   await w.get('.paper-drafts__check input').setValue(true)
   w.findComponent(LatexEditor).vm.$emit('update:modelValue','Unsaved recovered source')
   await nextTick()
   expect(listLocalDrafts(storage,'owner-a','two')).toHaveLength(1)
   expect(listLocalDrafts(storage,'owner-b','two')).toHaveLength(0)
   w.unmount()
   w=await open()
   expect(w.get('[data-test="editor"]').text()).toBe('Current source')
   await w.findAll('button').find(b=>b.text().startsWith('草稿恢复'))!.trigger('click')
   expect(w.get('[aria-label="本机草稿源码"]').element).toHaveProperty('value','Unsaved recovered source')
   vi.mocked(savePaperFile).mockResolvedValue({...f2,content:'Unsaved recovered source',revision:2,project_head_revision:2} as never)
   await w.findAll('button').find(b=>b.text()==='恢复到编辑器')!.trigger('click'); await w.getComponent(PConfirm).vm.$emit('confirm')
   await flushPromises()
   expect(w.get('[data-test="editor"]').text()).toBe('Unsaved recovered source')
   await w.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises()
   expect(savePaperFile).toHaveBeenCalledWith('two','f2','Unsaved recovered source',1)
   expect(listLocalDrafts(storage,'owner-a','two')).toHaveLength(0)
  }finally{w.unmount();vi.unstubAllGlobals()}
 })
 it('does not let a stale or deleted-file draft overwrite a newer server source',async()=>{
  const storage=storageFixture()
  const row:PaperLocalDraft={version:1,owner:'owner-a',projectId:'two',fileId:'f2',writerId:'other-window',path:'main.tex',baseRevision:9,baseSHA:'',content:'Older local source',updatedAt:Date.now()}
  writeLocalDraft(storage,row)
  const w=await open()
  try{
   await w.findAll('button').find(b=>b.text().startsWith('草稿恢复'))!.trigger('click')
   expect(w.text()).toContain('需手动合并')
   expect(w.findAll('button').find(b=>b.text()==='恢复到编辑器')!.attributes('disabled')).toBeDefined()
   expect(w.get('[data-test="editor"]').text()).toBe('Current source')
   expect(savePaperFile).not.toHaveBeenCalled()
  }finally{w.unmount();vi.unstubAllGlobals()}
 })
})

describe('Papers shared project access',()=>{
 const uid='550e8400-e29b-41d4-a716-446655440000'
 async function open(role:'owner'|'editor'|'viewer'){
  vi.mocked(getPaperProject).mockResolvedValue({...two,access_role:role} as never)
  vi.mocked(listPaperFiles).mockResolvedValue([{...f2}] as never)
  vi.mocked(getPaperFile).mockResolvedValue({...f2} as never)
  vi.mocked(getPaperCompileCapability).mockResolvedValue({enabled:true,pdf_available:true,compilers:['pdflatex']})
  vi.mocked(listPaperMembers).mockResolvedValue([])
  vi.mocked(listPaperCompileJobs).mockResolvedValue([])
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView}]})
  await router.push('/papers/two');await router.isReady()
  const w=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
  await flushPromises()
  expect(w.text()).toContain('项目成员')
  return w
 }
 it('lets only the owner grant, update and revoke a verified account membership',async()=>{
  const w=await open('owner')

  const member={user_id:uid,role:'editor' as const,created_at:'2026-11-25T00:00:00Z',updated_at:'2026-11-25T00:00:00Z'}
  try{
   await w.findAll('button').find(b=>b.text()==='项目成员')!.trigger('click');await flushPromises()
   expect(listPaperMembers).toHaveBeenCalledWith('two')
   await w.get('[aria-label="成员账号 UUID"]').setValue(uid)
   vi.mocked(setPaperMember).mockResolvedValue(member)
   vi.mocked(listPaperMembers).mockResolvedValue([member])
   await w.get('.paper-members__form').trigger('submit'); await w.getComponent(PConfirm).vm.$emit('confirm');await flushPromises()
   expect(setPaperMember).toHaveBeenCalledWith('two',uid,'editor')
   expect(w.text()).toContain(uid)
   vi.mocked(setPaperMember).mockResolvedValue({...member,role:'viewer'})
   vi.mocked(listPaperMembers).mockResolvedValue([{...member,role:'viewer'}])
   await w.findAll('button').find(b=>b.text()==='改为阅读者')!.trigger('click'); await w.getComponent(PConfirm).vm.$emit('confirm');await flushPromises()
   expect(setPaperMember).toHaveBeenCalledWith('two',uid,'viewer')
   vi.mocked(removePaperMember).mockResolvedValue({deleted:true})
   vi.mocked(listPaperMembers).mockResolvedValue([])
   await w.findAll('button').find(b=>b.text()==='移除')!.trigger('click'); await w.getComponent(PConfirm).vm.$emit('confirm');await flushPromises()
   expect(removePaperMember).toHaveBeenCalledWith('two',uid)
   expect(w.text()).toContain('暂无共享成员')
  }finally{w.unmount();vi.unstubAllGlobals()}
 })
 it('enforces reader read-only UI and prevents accidental model saves',async()=>{
  const w=await open('viewer')
  try{
   expect(w.get('[data-test="editor"]').attributes('data-readonly')).toBe('true')
   expect(w.text()).toContain('共享阅读')
   expect(w.find('form.papers-workspace__add').exists()).toBe(false)
   for(const title of ['保存','插图','版本历史','项目快照','导出 ZIP','全部替换']){
    expect(w.findAll('button').some(b=>b.text()===title)).toBe(false)
   }
   expect(w.findAll('button').find(b=>b.text()==='编译')!.attributes('disabled')).toBeDefined()
   w.findComponent(LatexEditor).vm.$emit('update:modelValue','Unauthorized edit')
   await nextTick()
   expect(w.get('[data-test="editor"]').text()).toBe('Current source')
   expect(savePaperFile).not.toHaveBeenCalled()
   await w.findAll('button').find(b=>b.text()==='项目成员')!.trigger('click');await flushPromises()
   expect(w.find('.paper-members__form').exists()).toBe(false)
   expect(listPaperMembers).not.toHaveBeenCalled()
  }finally{w.unmount()}
 })
 it('allows an editor to save existing source but refuses structural edits or refresh of dirty source',async()=>{
  const w=await open('editor')
  try{
   expect(w.get('[data-test="editor"]').attributes('data-readonly')).toBe('false')
   expect(w.find('form.papers-workspace__add').exists()).toBe(false)
   expect(w.text()).toContain('共享编辑')
   w.findComponent(LatexEditor).vm.$emit('update:modelValue','Editor update')
   await nextTick()
   await w.findAll('button').find(b=>b.text()==='刷新项目')!.trigger('click');await flushPromises()
   expect(w.text()).toContain('未刷新项目')
   expect(w.get('[data-test="editor"]').text()).toBe('Editor update')
   vi.mocked(savePaperFile).mockResolvedValue({...f2,content:'Editor update',revision:2,project_head_revision:2} as never)
   await w.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises()
   expect(savePaperFile).toHaveBeenCalledWith('two','f2','Editor update',1)
   expect(managePaperFiles).not.toHaveBeenCalled()
   const fresh={...f2,content:'Newest server source',revision:3}
   vi.mocked(getPaperProject).mockResolvedValue({...two,access_role:'viewer',head_revision:3} as never)
   vi.mocked(listPaperFiles).mockResolvedValue([fresh] as never)
   vi.mocked(getPaperFile).mockResolvedValue(fresh as never)
   await w.findAll('button').find(b=>b.text()==='刷新项目')!.trigger('click');await flushPromises()
   expect(w.get('[data-test="editor"]').text()).toBe('Newest server source')
   expect(w.get('[data-test="editor"]').attributes('data-readonly')).toBe('true')
  }finally{w.unmount()}
 })
})

describe('Papers realtime collaboration gate',()=>{
 async function openGate(){
  vi.mocked(getPaperProject).mockResolvedValue({...two,access_role:'owner'} as never)
  vi.mocked(listPaperFiles).mockResolvedValue([f2] as never)
  vi.mocked(getPaperFile).mockResolvedValue(f2 as never)
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/papers/:projectId',component:PaperWorkspaceView},{path:'/papers',component:{template:'<div />'}}]})
  await router.push('/papers/two');await router.isReady()
  const w=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[router]}})
  await flushPromises()
  return {w,router}
 }
 const button=(w:Awaited<ReturnType<typeof openGate>>['w'],label:string)=>w.findAll('button').find(b=>b.text()===label)!
 it('keeps the ordinary editor and save available when collaboration is disabled',async()=>{
  vi.mocked(getPaperCollaborationCapability).mockResolvedValue({enabled:false})
  const create=vi.fn();vi.stubGlobal('WebSocket',create)
  const {w,router}=await openGate()
  try{
   expect(getPaperCollaborationCapability).toHaveBeenCalledWith('two','f2')
   expect(button(w,'实时协作').attributes('disabled')).toBeDefined()
   expect(w.text()).toContain('实时协作尚未开放')
   expect(w.get('[data-test="editor"]').text()).toBe('Current source')
   expect(button(w,'保存').attributes('disabled')).toBeUndefined()
   expect(create).not.toHaveBeenCalled()
   expect(savePaperFile).not.toHaveBeenCalled()
   await router.push('/papers');await flushPromises()
   expect(router.currentRoute.value.path).toBe('/papers')
  }finally{w.unmount();vi.unstubAllGlobals()}
 })
 it('distinguishes an old-backend 404 from network failure and permits retry',async()=>{
  vi.mocked(getPaperCollaborationCapability).mockRejectedValue(new ApiErrorResponseError(404,'not_found','Not found'))
  const {w}=await openGate()
  try{
   expect(w.text()).toContain('实时协作接口尚不可用')
   expect(button(w,'实时协作').attributes('disabled')).toBeDefined()
   expect(w.get('[data-test="editor"]').text()).toBe('Current source')
   vi.mocked(getPaperCollaborationCapability).mockRejectedValue(new Error('offline'))
   await button(w,'重新检查').trigger('click');await flushPromises()
   expect(w.text()).toContain('暂时无法验证实时协作能力')
   vi.mocked(getPaperCollaborationCapability).mockResolvedValue({enabled:true,protocol:'papers-crdt-v1',role:'owner'})
   await button(w,'重新检查').trigger('click');await flushPromises()
   expect(button(w,'实时协作').attributes('disabled')).toBeUndefined()
   expect(w.get('[data-test="editor"]').text()).toBe('Current source')
  }finally{w.unmount()}
 })
 it('returns to ordinary editing without reloading or saving if the panel recheck fails',async()=>{
  vi.mocked(getPaperCollaborationCapability)
   .mockResolvedValueOnce({enabled:true,protocol:'papers-crdt-v1',role:'owner'})
   .mockResolvedValue({enabled:false})
  const create=vi.fn();vi.stubGlobal('WebSocket',create)
  const {w}=await openGate()
  try{
   const initialReads=vi.mocked(getPaperFile).mock.calls.length
   await button(w,'实时协作').trigger('click');await flushPromises()
   expect(getPaperCollaborationCapability).toHaveBeenCalledTimes(2)
   expect(w.get('[data-test="editor"]').text()).toBe('Current source')
   expect(button(w,'实时协作').attributes('disabled')).toBeDefined()
   expect(w.text()).toContain('实时协作尚未开放')
   expect(vi.mocked(getPaperFile).mock.calls.length).toBe(initialReads)
   expect(savePaperFile).not.toHaveBeenCalled()
   expect(create).not.toHaveBeenCalled()
  }finally{w.unmount();vi.unstubAllGlobals()}
 })
 it('does not let a late capability response enable another project',async()=>{
  let release!: (value:{enabled:boolean;protocol:string;role:'owner'})=>void
  vi.mocked(getPaperCollaborationCapability).mockImplementation(pid=>pid==='two'
   ?new Promise(resolve=>{release=resolve}):Promise.resolve({enabled:false}))
  const {w,router}=await openGate()
  try{
   expect(button(w,'实时协作').attributes('disabled')).toBeDefined()
   vi.mocked(getPaperProject).mockResolvedValue({...one,access_role:'owner'} as never)
   vi.mocked(listPaperFiles).mockResolvedValue([f1] as never)
   vi.mocked(getPaperFile).mockResolvedValue(f1 as never)
   await router.push('/papers/one');await flushPromises()
   release({enabled:true,protocol:'papers-crdt-v1',role:'owner'});await flushPromises()
   expect(w.get('[data-test="editor"]').text()).toBe('Old source')
   expect(button(w,'实时协作').attributes('disabled')).toBeDefined()
   expect(w.text()).toContain('实时协作尚未开放')
  }finally{w.unmount()}
 })
})
