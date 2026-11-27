import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PaperPDFPreview from '@/components/papers/PaperPDFPreview.vue'

const pdf = vi.hoisted(() => ({ getDocument: vi.fn() }))
vi.mock('@/utils/bookReaderEngines', () => ({
  loadPdfEngine: async () => ({ getDocument: pdf.getDocument }),
}))
vi.mock('@/api/papers', () => ({ getPaperCompilePDF: vi.fn() }))

function documentFixture() {
  return {
    numPages: 1,
    getPage: vi.fn(async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 320 * scale, height: 600 * scale,
      }),
    })),
  }
}

function loadingTask(promise = Promise.resolve(documentFixture())) {
  return { promise, destroy: vi.fn(async () => {}) }
}

function deferredDocument() {
  let resolve!: (value: ReturnType<typeof documentFixture>) => void
  const promise = new Promise<ReturnType<typeof documentFixture>>(r => { resolve = r })
  return { task: loadingTask(promise), resolve }
}

function asset(name: string) {
  return new Blob(['%PDF-', name], { type: 'application/pdf' })
}

afterEach(() => {
  pdf.getDocument.mockReset()
  vi.restoreAllMocks()
})

describe('Papers PDF preview document identity', () => {
  it('keeps the previous name and download bytes until a new PDF is ready, and clears the old marker', async () => {
    const initial = loadingTask()
    const replacement = deferredDocument()
    pdf.getDocument.mockReturnValueOnce(initial).mockReturnValueOnce(replacement.task)
    const previous = asset('first')
    const next = asset('second')
    const wrapper = mount(PaperPDFPreview, {
      props: { projectId: 'p', jobId: 'a', revision: 1, assetBlob: previous, assetName: 'first.pdf' },
    })
    try {
      await vi.waitFor(() => expect(wrapper.emitted('displayed-job')).toEqual([['a']]))
      expect(wrapper.get('.paper-pdf__footer').text()).toContain('first.pdf')
      expect(await wrapper.vm.showPosition(1, 20, 40, 'a')).toBe(true)
      await flushPromises()
      expect(wrapper.find('.paper-pdf__sync-marker').exists()).toBe(true)

      await wrapper.setProps({ jobId: 'b', revision: 2, assetBlob: next, assetName: 'second.pdf' })
      await vi.waitFor(() => expect(pdf.getDocument).toHaveBeenCalledTimes(2))
      expect(wrapper.get('.paper-pdf__footer').text()).toContain('first.pdf')
      expect(wrapper.get('.paper-pdf__footer').text()).not.toContain('second.pdf')
      const createURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture')
      let downloaded = ''
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this.download
      })
      await wrapper.findAll('button').find(b => b.text() === '下载 PDF')!.trigger('click')
      expect(createURL).toHaveBeenCalledWith(previous)
      expect(downloaded).toBe('first.pdf')

      replacement.resolve(documentFixture())
      await vi.waitFor(() => expect(wrapper.emitted('displayed-job')).toEqual([['a'], ['b']]))
      expect(wrapper.get('.paper-pdf__footer').text()).toContain('second.pdf')
      expect(wrapper.find('.paper-pdf__sync-marker').exists()).toBe(false)
      expect(initial.destroy).toHaveBeenCalledOnce()
      expect(await wrapper.vm.showPosition(1, 20, 40, 'a')).toBe(false)
    } finally { wrapper.unmount() }
  })

  it('does not publish an older PDF result after a later request completes', async () => {
    const first = deferredDocument()
    const second = loadingTask()
    pdf.getDocument.mockReturnValueOnce(first.task).mockReturnValueOnce(second)
    const wrapper = mount(PaperPDFPreview, {
      props: { projectId: 'p', jobId: 'old', revision: 1, assetBlob: asset('old'), assetName: 'old.pdf' },
    })
    try {
      await vi.waitFor(() => expect(pdf.getDocument).toHaveBeenCalledTimes(1))
      await wrapper.setProps({ jobId: 'new', revision: 2, assetBlob: asset('new'), assetName: 'new.pdf' })
      await vi.waitFor(() => expect(wrapper.emitted('displayed-job')).toEqual([['new']]))
      first.resolve(documentFixture())
      await flushPromises()
      expect(wrapper.emitted('displayed-job')).toEqual([['new']])
      expect(wrapper.emitted('page-count')).toEqual([[{ jobId: 'new', revision: 2, pages: 1 }]])
      expect(wrapper.get('.paper-pdf__footer').text()).toContain('new.pdf')
      expect(first.task.destroy).toHaveBeenCalled()
    } finally { wrapper.unmount() }
  })
})
