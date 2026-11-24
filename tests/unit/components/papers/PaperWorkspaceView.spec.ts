import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h, nextTick } from 'vue'
import PaperWorkspaceView from '@/views/papers/PaperWorkspaceView.vue'
import { getPaperFile, getPaperProject, listPaperFiles, getPaperCompileCapability, listPaperCompileJobs, submitPaperCompile, cancelPaperCompile } from '@/api/papers'

vi.mock('@/api/papers', () => ({
  getPaperProject: vi.fn(),
  listPaperFiles: vi.fn(),
  getPaperFile: vi.fn(),
  savePaperFile: vi.fn(),
  createPaperFile: vi.fn(),
  getPaperCompileCapability: vi.fn().mockResolvedValue({ enabled: false, pdf_available: false }),
  listPaperCompileJobs: vi.fn().mockResolvedValue([]),
  submitPaperCompile: vi.fn(),
  getPaperCompileJob: vi.fn(),
  cancelPaperCompile: vi.fn(),
}))
vi.mock('@/components/papers/LatexEditor.vue', () => ({
  default: { props: ['modelValue'], template: '<pre data-test="editor">{{ modelValue }}</pre>' },
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
