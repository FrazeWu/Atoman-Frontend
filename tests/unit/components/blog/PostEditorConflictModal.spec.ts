import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PostEditorConflictModal from '@/components/blog/PostEditorConflictModal.vue'
import * as textDownload from '@/utils/textDownload'

describe('PostEditorConflictModal', () => {
  const defaultProps = {
    show: true,
    localTitle: '本地修改后的标题',
    localContent: '这是本地未保存的最新正文内容',
    remoteTitle: '云端已被修改的标题',
    remoteContent: '这是来自其他会话的远端正文内容',
    remoteUpdatedAt: '2026-11-15T10:30:00Z',
    loadingRemote: false,
    saving: false,
  }

  const modalStub = {
    props: ['show', 'title', 'size'],
    template: '<div class="p-modal-stub"><slot /><slot name="footer" /></div>',
  }

  it('展示版本冲突对比信息与字符数统计', () => {
    const wrapper = mount(PostEditorConflictModal, {
      props: defaultProps,
      global: {
        stubs: {
          PModal: modalStub,
        },
      },
    })

    expect(wrapper.text()).toContain('云端内容已在其他会话或设备更新')
    expect(wrapper.text()).toContain('本地未保存修改')
    expect(wrapper.text()).toContain('本地修改后的标题')
    expect(wrapper.text()).toContain('云端最新版本')
    expect(wrapper.text()).toContain('云端已被修改的标题')
    expect(wrapper.text()).toContain(`${defaultProps.localContent.length} 字符`)
    expect(wrapper.text()).toContain(`${defaultProps.remoteContent.length} 字符`)
  })

  it('点击导出本地副本时触发 Markdown 物理文件下载', async () => {
    const downloadSpy = vi.spyOn(textDownload, 'downloadTextFile').mockImplementation(() => {})
    const wrapper = mount(PostEditorConflictModal, {
      props: defaultProps,
      global: {
        stubs: {
          PModal: modalStub,
        },
      },
    })

    const exportBtn = wrapper.findAll('button').find(btn => btn.text().includes('导出本地副本'))
    expect(exportBtn).toBeTruthy()
    await exportBtn?.trigger('click')

    expect(downloadSpy).toHaveBeenCalled()
    const [fileName, content, ext] = downloadSpy.mock.calls[0]
    expect(fileName).toContain('本地修改后的标题-本地备份-')
    expect(content).toContain('# 本地修改后的标题\n\n这是本地未保存的最新正文内容')
    expect(ext).toBe('.md')
    downloadSpy.mockRestore()
  })

  it('点击覆盖云端保存触发 overwrite 事件', async () => {
    const wrapper = mount(PostEditorConflictModal, {
      props: defaultProps,
      global: {
        stubs: {
          PModal: modalStub,
        },
      },
    })

    const overwriteBtn = wrapper.findAll('button').find(btn => btn.text().includes('覆盖云端保存'))
    expect(overwriteBtn).toBeTruthy()
    await overwriteBtn?.trigger('click')

    expect(wrapper.emitted('overwrite')).toBeTruthy()
  })

  it('点击放弃修改并拉取最新触发 discard 事件', async () => {
    const wrapper = mount(PostEditorConflictModal, {
      props: defaultProps,
      global: {
        stubs: {
          PModal: modalStub,
        },
      },
    })

    const discardBtn = wrapper.findAll('button').find(btn => btn.text().includes('放弃修改并拉取最新'))
    expect(discardBtn).toBeTruthy()
    await discardBtn?.trigger('click')

    expect(wrapper.emitted('discard')).toBeTruthy()
  })
})
