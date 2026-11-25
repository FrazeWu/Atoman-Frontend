import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import PapersHomeView from '@/views/papers/PapersHomeView.vue'
import PConfirm from '@/components/ui/PConfirm.vue'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  rename:vi.fn(),trash:vi.fn(),listTrash:vi.fn(),restore:vi.fn(),
  application: vi.fn(),
  projects: vi.fn(),
  listApplications: vi.fn(),
  importProject: vi.fn(),
  exportProject: vi.fn(),
  download: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/api/papers', () => ({
  paperAccess: mocks.access,
  getPaperApplication: mocks.application,
  listPaperProjects: mocks.projects,
  renamePaperProject:mocks.rename,trashPaperProject:mocks.trash,listTrashedPaperProjects:mocks.listTrash,restorePaperProject:mocks.restore,
  createPaperProject: vi.fn(),
  submitPaperApplication: vi.fn(),
  importPaperProject: mocks.importProject,
  getPaperProjectZIP: mocks.exportProject,
  downloadPaperZIP: mocks.download,
  paperImportZIPLimit: 5 * 1024 * 1024,
  paperImportSourceLimit: 4 * 1024 * 1024,
  listPaperApplications: mocks.listApplications,
  reviewPaperApplication: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { role: 'owner' } }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }), RouterLink: defineComponent({template:'<a><slot /></a>'}) }))

describe('Papers home', () => {
  it('keeps even administrator home pages free of review controls', async () => {
    mocks.access.mockResolvedValue({allowed:true})
    mocks.projects.mockResolvedValue([])
    const wrapper = mount(PapersHomeView, {global:{stubs:{PPageHeader:true, PButton:true, PaperApplicationReview:defineComponent({template:'<div data-test="unexpected-review" />'})}}})
    await flushPromises()
    expect(wrapper.text()).toContain('我的论文')
    expect(wrapper.find('[data-test="unexpected-review"]').exists()).toBe(false)
    expect(mocks.listApplications).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps the applicant form on the Papers home page', async () => {
    mocks.access.mockResolvedValue({allowed:false})
    mocks.application.mockResolvedValue({application:null})
    const wrapper = mount(PapersHomeView, {global:{stubs:{PPageHeader:true,PButton:true}}})
    await flushPromises()
    expect(wrapper.text()).toContain('申请使用 Atoman Papers')
    expect(wrapper.find('textarea#paper-application-reason').exists()).toBe(true)
    expect(mocks.listApplications).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('imports a selected ZIP and opens the resulting project', async () => {
    mocks.access.mockResolvedValue({allowed:true})
    mocks.projects.mockResolvedValue([])
    mocks.importProject.mockResolvedValue({id:'imported'})
    const wrapper = mount(PapersHomeView, {global:{stubs:{PPageHeader:true,PButton:true}}})
    await flushPromises()
    const input=wrapper.get('input[type="file"][accept]')
    const zip=new File([new Uint8Array([80,75,3,4])],'Research.zip',{type:'application/zip'})
    Object.defineProperty(input.element,'files',{value:[zip]})
    await input.trigger('change')
    expect((wrapper.get('#paper-project-name').element as HTMLInputElement).value).toBe('Research')
    await wrapper.get('form.papers-home__create').trigger('submit')
    await flushPromises()
    expect(mocks.importProject).toHaveBeenCalledWith('Research',zip,'')
    expect(mocks.push).toHaveBeenCalledWith('/papers/imported')
    wrapper.unmount()
  })
  it('exports a previously created project using the authenticated ZIP API', async () => {
    const project={id:'existing',name:'Existing paper',head_revision:3,updated_at:'2026-11-24T00:00:00Z'}
    mocks.access.mockResolvedValue({allowed:true})
    mocks.projects.mockResolvedValue([project])
    const zip=new Blob(['fixture'],{type:'application/zip'})
    mocks.exportProject.mockResolvedValue(zip)
    const wrapper=mount(PapersHomeView,{global:{stubs:{PPageHeader:true,PButton:defineComponent({emits:['click'],template:'<button @click="$emit(\'click\',$event)"><slot /></button>'})}}})
    await flushPromises()
    await wrapper.get('.papers-home__card button').trigger('click')
    await flushPromises()
    expect(mocks.exportProject).toHaveBeenCalledWith('existing')
    expect(mocks.download).toHaveBeenCalledWith(zip,'Existing paper')
    wrapper.unmount()
  })
  it('requires an explicit confirmation before retrying ZIP import with exclusions', async () => {
    mocks.access.mockResolvedValue({allowed:true})
    mocks.projects.mockResolvedValue([])
    mocks.importProject.mockReset()
    mocks.push.mockClear()
    const confirmation='sha256:'+'a'.repeat(64)
    const challenge=Object.assign(new Error('Unsupported files'),{code:'papers.archive_exclusion_required',details:{files:['JailBound_preprintv2/pic/plot_asr_scaling_v2.py','main.log'],confirmation}})
    mocks.importProject.mockRejectedValueOnce(challenge).mockResolvedValueOnce({id:'confirmed'})
    const wrapper=mount(PapersHomeView,{global:{stubs:{PPageHeader:true}}})
    await flushPromises()
    const zip=new File([new Uint8Array([80,75,3,4])],'JailBound.zip',{type:'application/zip'})
    const input=wrapper.get('input[type="file"][accept]')
    Object.defineProperty(input.element,'files',{value:[zip]})
    await input.trigger('change')
    await wrapper.get('form.papers-home__create').trigger('submit')
    await flushPromises()
    expect(mocks.importProject).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('JailBound_preprintv2/pic/plot_asr_scaling_v2.py')
    expect(wrapper.text()).toContain('原始文件夹和 ZIP 压缩包不会被修改')
    expect(mocks.push).not.toHaveBeenCalled()
    const confirm=wrapper.findAll('button').find(b=>b.text()==='排除这些文件并继续导入')!
    await confirm.trigger('click')
    await flushPromises()
    expect(mocks.importProject).toHaveBeenCalledTimes(2)
    expect(mocks.importProject).toHaveBeenLastCalledWith('JailBound',zip,'',confirmation)
    expect(mocks.push).toHaveBeenCalledWith('/papers/confirmed')
    wrapper.unmount()
  })
  it('does not upload a selected folder until the user approves unsupported files', async () => {
    mocks.access.mockResolvedValue({allowed:true})
    mocks.projects.mockResolvedValue([])
    mocks.importProject.mockReset()
    mocks.push.mockClear()
    mocks.importProject.mockResolvedValue({id:'folder'})
    const wrapper=mount(PapersHomeView,{global:{stubs:{PPageHeader:true}}})
    await flushPromises()
    const main=new File(['TeX'],'main.tex')
    const script=new File(['plot'],'plot.py')
    Object.defineProperty(main,'webkitRelativePath',{value:'Research/main.tex'})
    Object.defineProperty(script,'webkitRelativePath',{value:'Research/pic/plot.py'})
    const input=wrapper.get('input[webkitdirectory]')
    Object.defineProperty(input.element,'files',{value:[main,script]})
    await input.trigger('change')
    await wrapper.get('form.papers-home__create').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('pic/plot.py')
    expect(mocks.importProject).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(b=>b.text()==='取消导入')!.trigger('click')
    expect(mocks.importProject).not.toHaveBeenCalled()
    expect(wrapper.find('.papers-home__exclusion').exists()).toBe(false)
    await wrapper.get('form.papers-home__create').trigger('submit')
    await flushPromises()
    await wrapper.findAll('button').find(b=>b.text()==='排除这些文件并继续导入')!.trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(mocks.importProject).toHaveBeenCalledTimes(1)
      expect(mocks.push).toHaveBeenCalledWith('/papers/folder')
    }, { timeout: 5000 })
    wrapper.unmount()
  })
})

it('renames, trashes and restores an owned project through the project list',async()=>{
 const project={id:'p1',name:'Old',head_revision:1,updated_at:'2026-11-24T00:00:00Z'}
 const updated={...project,name:'New',head_revision:2}
 mocks.access.mockResolvedValue({allowed:true});mocks.projects.mockResolvedValue([project])
 mocks.rename.mockResolvedValue(updated);mocks.trash.mockResolvedValue(undefined)
 mocks.listTrash.mockResolvedValue([{...updated,trashed_at:'2026-11-24T00:00:00Z'}]);mocks.restore.mockResolvedValue(updated)
 const w=mount(PapersHomeView,{global:{stubs:{PPageHeader:true}}})
 try{
  await flushPromises()
  await w.findAll('button').find(b=>b.text()==='重命名')!.trigger('click')
  await w.get('[aria-label="新的项目名称"]').setValue('New')
  await w.findAll('button').find(b=>b.text()==='确认')!.trigger('click')
  await flushPromises();expect(mocks.rename).toHaveBeenCalledWith('p1','New',1)
  expect(w.get('.papers-home__card').text()).toContain('New')
  await w.findAll('button').find(b=>b.text()==='删除')!.trigger('click')
  expect(mocks.trash).not.toHaveBeenCalled()
  expect(w.getComponent(PConfirm).props('show')).toBe(true)
  w.getComponent(PConfirm).vm.$emit('confirm')
  await flushPromises();expect(mocks.trash).toHaveBeenCalledWith('p1');expect(w.find('.papers-home__card').exists()).toBe(false)
  await w.findAll('button').find(b=>b.text()==='回收站')!.trigger('click')
  await flushPromises();await w.findAll('button').find(b=>b.text()==='恢复')!.trigger('click')
  await flushPromises();expect(mocks.restore).toHaveBeenCalledWith('p1')
  await w.findAll('button').find(b=>b.text()==='返回项目')!.trigger('click')
  expect(w.get('.papers-home__card').text()).toContain('New')
 }finally{vi.unstubAllGlobals();w.unmount()}
})

describe('Papers template library',()=>{
  async function open(){
    mocks.access.mockResolvedValue({allowed:true})
    mocks.projects.mockResolvedValue([])
    mocks.importProject.mockReset()
    mocks.push.mockClear()
    const w=mount(PapersHomeView,{global:{stubs:{PPageHeader:true}}})
    await flushPromises()
    await w.findAll('button').find(b=>b.text()==='模板库')!.trigger('click')
    return w
  }
  it('filters templates, creates an original Chinese thesis by atomic ZIP import, and retains a custom project name',async()=>{
    const w=await open()
    try{
      await w.get('#paper-project-name').setValue('My dissertation')
      await w.findAll('button').find(b=>b.text()==='中文论文')!.trigger('click')
      expect(w.findAll('.paper-templates__card')).toHaveLength(2)
      const card=w.findAll('.paper-templates__card').find(c=>c.text().includes('中文学位论文通用稿'))!
      await card.get('button').trigger('click')
      expect((w.get('#paper-project-name').element as HTMLInputElement).value).toBe('My dissertation')
      expect(w.text()).toContain('需 XeLaTeX 中文环境')
      mocks.importProject.mockResolvedValue({id:'template-p'})
      await w.get('form.papers-home__create').trigger('submit')
      await vi.waitFor(()=>expect(mocks.importProject).toHaveBeenCalledTimes(1),{timeout:5000})
      const [name,archive,main]=mocks.importProject.mock.calls[0]!
      expect(name).toBe('My dissertation')
      expect(main).toBe('main.tex')
      const {default:JSZip}=await import('jszip')
      const zip=await JSZip.loadAsync(await (archive as Blob).arrayBuffer())
      expect(await zip.file('main.tex')!.async('string')).toContain('ctexbook')
      expect(w.text()).toContain('中文学位论文通用稿')
      expect(mocks.push).toHaveBeenCalledWith('/papers/template-p')
    }finally{w.unmount()}
  })
  it('labels conference drafts as non-official and exposes publisher sources; does not silently retry failed template imports',async()=>{
    const w=await open()
    try{
      await w.get('[aria-label="搜索论文模板"]').setValue('NeurIPS')
      expect(w.findAll('.paper-templates__card')).toHaveLength(1)
      const card=w.get('.paper-templates__card')
      expect(card.text()).toContain('非官方投稿格式')
      expect(card.get('a').attributes('href')).toContain('neurips.cc/Conferences/2026/')
      expect(card.get('a').attributes('rel')).toBe('noopener noreferrer')
      await card.get('button').trigger('click')
      mocks.importProject.mockRejectedValueOnce(new Error('quota'))
      await w.get('form.papers-home__create').trigger('submit')
      await vi.waitFor(()=>expect(w.text()).toContain('模板创建失败'),{timeout:5000})
      expect(mocks.importProject).toHaveBeenCalledTimes(1)
      expect(mocks.push).not.toHaveBeenCalled()
      expect(w.find('.papers-home__exclusion').exists()).toBe(false)
      expect(w.text()).toContain('NeurIPS 2026 写作稿')
    }finally{w.unmount()}
  })
})

describe('Papers shared project list',()=>{
 it('shows shared roles and never offers owner-only operations to collaborators',async()=>{
  mocks.access.mockResolvedValue({allowed:true})
  mocks.projects.mockResolvedValue([
   {id:'owner',name:'Owned',access_role:'owner',head_revision:1,updated_at:'2026-11-25T00:00:00Z'},
   {id:'editor',name:'Shared edit',access_role:'editor',head_revision:2,updated_at:'2026-11-25T00:00:00Z'},
   {id:'viewer',name:'Shared view',access_role:'viewer',head_revision:3,updated_at:'2026-11-25T00:00:00Z'},
  ])
  const w=mount(PapersHomeView,{global:{stubs:{PPageHeader:true}}})
  try{
   await flushPromises()
   const cards=w.findAll('.papers-home__card')
   expect(cards).toHaveLength(3)
   expect(cards[0]!.text()).toContain('所有者')
   expect(cards[0]!.text()).toContain('删除')
   expect(cards[1]!.text()).toContain('编辑者')
   expect(cards[2]!.text()).toContain('阅读者')
   for(const card of cards.slice(1))expect(card.find('.papers-home__project-actions').exists()).toBe(false)
  }finally{w.unmount()}
 })
})
