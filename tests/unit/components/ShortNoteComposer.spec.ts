import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

import ShortNoteComposer from '@/components/shortnote/ShortNoteComposer.vue'
import { apiRequestResult } from '@/api/client'

vi.mock('@/api/client', () => ({ apiRequestResult: vi.fn() }))

const mockedApiRequestResult = vi.mocked(apiRequestResult)

function uploadFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  return input.trigger('change')
}

afterEach(() => mockedApiRequestResult.mockReset())

describe('ShortNoteComposer', () => {
  it('shows the 500-character limit and an image picker', () => {
    const wrapper = mount(ShortNoteComposer, { global: { plugins: [createPinia()] } })

    expect(wrapper.text()).toContain('0/500')
    expect(wrapper.find('input[type="file"]').attributes('accept')).toContain('image/')
    expect(wrapper.get('button[type="submit"]').text()).toBe('发布')
    expect(wrapper.get('textarea').classes()).toContain('p-textarea')
  })

  it('emits trimmed content when submitted', async () => {
    const wrapper = mount(ShortNoteComposer, { global: { plugins: [createPinia()] } })

    await wrapper.get('textarea').setValue('  一条短话  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{ content: '一条短话', media_urls: [] }]])
  })

  it('enables drag sorting when multiple images are present', () => {
    const wrapper = mount(ShortNoteComposer, {
      props: { initialMediaUrls: ['https://example.test/one.jpg', 'https://example.test/two.jpg'] },
      global: { plugins: [createPinia()] },
    })

    expect(wrapper.find('[data-testid="short-note-media"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="short-note-drag-handle"]')).toHaveLength(2)
  })

  it('keeps text input enabled while an image is uploading', async () => {
    let completeUpload: ((response: Response) => void) | undefined
    mockedApiRequestResult.mockImplementation(() => new Promise((resolve) => {
      completeUpload = response => resolve({
        ok: response.ok,
        status: response.status,
        data: { url: 'https://cdn.example.test/image.jpg' },
        headers: response.headers,
      })
    }))
    const wrapper = mount(ShortNoteComposer, { global: { plugins: [createPinia()] } })

    await uploadFile(wrapper, new File(['image'], 'image.jpg', { type: 'image/jpeg' }))

    expect(wrapper.get('textarea').attributes('disabled')).toBeUndefined()
    completeUpload?.({ ok: true, json: async () => ({ url: 'https://cdn.example.test/image.jpg' }) } as Response)
    await flushPromises()
  })

  it('uses the local object-storage proxy for MinIO previews', async () => {
    mockedApiRequestResult.mockResolvedValue({
      ok: true,
      status: 200,
      data: { url: 'http://localhost:9100/atoman-dev/blog/images/user/image.jpg' },
      headers: new Headers(),
    })
    const wrapper = mount(ShortNoteComposer, { global: { plugins: [createPinia()] } })

    await uploadFile(wrapper, new File(['image'], 'image.jpg', { type: 'image/jpeg' }))
    await flushPromises()

    expect(wrapper.get('img').attributes('src')).toBe('/__object-storage/atoman-dev/blog/images/user/image.jpg')
  })
})
