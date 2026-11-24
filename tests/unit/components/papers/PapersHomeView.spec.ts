import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import PapersHomeView from '@/views/papers/PapersHomeView.vue'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
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
