import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BookImportUploadModal from '@/components/books/BookImportUploadModal.vue'
import * as booksApi from '@/api/books'

describe('BookImportUploadModal', () => {
  it('renders modal when open', () => {
    const wrapper = mount(BookImportUploadModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          PModal: {
            template: '<div class="p-modal-stub"><h2>{{ title }}</h2><slot /><slot name="footer" /></div>',
            props: ['title', 'modelValue'],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('导入电子书')
    expect(wrapper.text()).toContain('支持 EPUB、PDF、TXT、MOBI、AZW3')
  })

  it('rejects unsupported file format', async () => {
    const wrapper = mount(BookImportUploadModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          PModal: {
            template: '<div><slot /><slot name="footer" /></div>',
          },
        },
      },
    })

    const file = new File(['dummy content'], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const input = wrapper.find<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: true,
    })

    await input.trigger('change')
    expect(wrapper.text()).toContain('仅支持 EPUB、PDF、TXT、MOBI 和 AZW3 文件')
  })

  it('uploads valid file and emits success', async () => {
    const mockSession = {
      id: 'import-123',
      title: '瓦尔登湖',
      file_name: 'walden.epub',
      format: 'epub',
      content_type: 'application/epub+zip',
      size: 1024,
      status: 'uploaded',
      completed_parts: [],
      expires_at: '2026-11-01T00:00:00Z',
      part_size: 1024,
    }

    vi.spyOn(booksApi, 'uploadBookFile').mockResolvedValue(mockSession as any)

    const wrapper = mount(BookImportUploadModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          PModal: {
            template: '<div><slot /><slot name="footer" /></div>',
          },
        },
      },
    })

    const file = new File(['valid epub content'], 'walden.epub', { type: 'application/epub+zip' })
    const input = wrapper.find<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [file],
      writable: true,
    })

    await input.trigger('change')
    // Wait for async upload promise
    await vi.waitFor(() => {
      expect(wrapper.emitted('success')).toBeTruthy()
    })

    expect(wrapper.emitted('success')![0]).toEqual([mockSession])
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })
})
