import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, h, nextTick } from 'vue'
import PaperWorkspaceView from '@/views/papers/PaperWorkspaceView.vue'
import { getPaperFile, getPaperProject, listPaperFiles } from '@/api/papers'

vi.mock('@/api/papers', () => ({
  getPaperProject: vi.fn(),
  listPaperFiles: vi.fn(),
  getPaperFile: vi.fn(),
  savePaperFile: vi.fn(),
  createPaperFile: vi.fn(),
}))
vi.mock('@/components/papers/LatexEditor.vue', () => ({
  default: { props: ['modelValue'], template: '<pre data-test="editor">{{ modelValue }}</pre>' },
}))

const one = { id: 'one', name: 'Old project', main_file_id: 'f1', head_revision: 1 }
const two = { id: 'two', name: 'Current project', main_file_id: 'f2', head_revision: 1 }
const f1 = { id: 'f1', path: 'old.tex', kind: 'text', revision: 1, content: 'Old source', sha256: '' }
const f2 = { id: 'f2', path: 'main.tex', kind: 'text', revision: 1, content: 'Current source', sha256: '' }

afterEach(() => vi.clearAllMocks())

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
