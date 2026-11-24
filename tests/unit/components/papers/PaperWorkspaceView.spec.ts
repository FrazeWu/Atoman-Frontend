import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h, nextTick } from 'vue'
import LatexEditor from "@/components/papers/LatexEditor.vue"
import PaperWorkspaceView from '@/views/papers/PaperWorkspaceView.vue'
import { savePaperFile, getPaperFile, getPaperProject, listPaperFiles, getPaperCompileCapability, listPaperCompileJobs, submitPaperCompile, cancelPaperCompile } from '@/api/papers'

vi.mock('@/api/papers', () => ({
  getPaperProject: vi.fn(),
  listPaperFiles: vi.fn(),
  getPaperFile: vi.fn(),
  savePaperFile: vi.fn(),
  createPaperFile: vi.fn(),
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
vi.mock('@/components/papers/LatexEditor.vue', () => ({
  default: { props: ['modelValue','readonly'], emits:['update:modelValue','show-pdf'], methods:{goToLine:jumpLine,getLine:()=>1}, template: '<pre data-test="editor" :data-readonly="String(readonly)">{{ modelValue }}</pre>' },
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
   await wrapper.findAll('button').find(b=>b.text()==='chapters/intro.tex')!.trigger('click')
   await wrapper.findAll('button').find(b=>b.text()==='appendix.tex')!.trigger('click')
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
