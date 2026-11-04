import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import * as resources from '@/api/bookResources'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { uuid: 'qa-user' } }) }))
vi.mock('@/api/bookResources', () => ({
  createCatalogResource: vi.fn(), createResourceUpload: vi.fn(),
  uploadResourceFile: vi.fn(), getResourceUpload: vi.fn(), resourceReaderPath: vi.fn(() => '/books/test'),
}))
const initialFile = () => new File(['synthetic test PDF'], 'threebody-test.pdf', { type: 'application/pdf' })
const props = () => ({ workId:'qa-work', editionId:'qa-edition', title:'三体', initialLanguage:'zh', initialFile:initialFile(), autoStart:true })
async function createView(input = props()) {
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{template:'<div />'}}]})
  await router.push('/');await router.isReady()
  return mount(BookResourceUpload,{props:input,global:{plugins:[router],stubs:{PConfirm:true,RouterLink:true}}})
}

describe('create work edition: one PDF selection and one upload',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();localStorage.clear()
    vi.mocked(resources.createCatalogResource).mockResolvedValue({ id:'qa-asset',format:'pdf' } as never)
    vi.mocked(resources.createResourceUpload).mockResolvedValue({ id:'qa-upload',asset_id:'qa-asset',status:'uploading' } as never)
    vi.mocked(resources.uploadResourceFile).mockResolvedValue({ id:'qa-upload',asset_id:'qa-asset',status:'uploaded' } as never)
    vi.mocked(resources.getResourceUpload).mockResolvedValue({ id:'qa-upload',asset_id:'qa-asset',status:'scanning' } as never)
  })
  it('uses the same selected file, uploads automatically once, and does not show a duplicate input',async()=>{
    const input=props(), wrapper=await createView(input)
    await flushPromises()
    expect(wrapper.text()).toContain('沿用上一步的文件（无需再次选择）')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(resources.createCatalogResource).toHaveBeenCalledTimes(1)
    expect(resources.createResourceUpload).toHaveBeenCalledTimes(1)
    expect(resources.uploadResourceFile).toHaveBeenCalledTimes(1)
    expect(vi.mocked(resources.uploadResourceFile).mock.calls[0]?.[0]?.name).toBe(input.initialFile.name)
    expect(vi.mocked(resources.uploadResourceFile).mock.calls[0]?.[0]?.size).toBe(input.initialFile.size)
    await wrapper.vm.$nextTick()
    expect(resources.uploadResourceFile).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('restores an existing scan session without re-uploading after remount',async()=>{
    localStorage.setItem('atoman:book-upload:qa-user:qa-work:qa-edition','qa-upload')
    const wrapper=await createView()
    await flushPromises()
    expect(resources.getResourceUpload).toHaveBeenCalledWith('qa-upload')
    expect(resources.createCatalogResource).not.toHaveBeenCalled()
    expect(resources.uploadResourceFile).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps the ordinary uploader manual and leaves optional sharing consent unchecked',async()=>{
    const wrapper=await createView({ ...props(), autoStart:false })
    await flushPromises()
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    expect(wrapper.get('input[type="checkbox"]').element.checked).toBe(false)
    expect(resources.uploadResourceFile).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
