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
})
