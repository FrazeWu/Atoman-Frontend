import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VideoEditorView from '@/views/video/VideoEditorView.vue'
import { useAuthStore } from '@/stores/auth'

class FakeXMLHttpRequest {
  status = 200
  responseText = JSON.stringify({ url: '/uploads/video/files/user-1/video.mp4' })
  upload = {
    addEventListener: vi.fn(),
  }
  private listeners: Record<string, Array<() => void>> = {}

  open = vi.fn()
  setRequestHeader = vi.fn()

  addEventListener(event: string, listener: () => void) {
    this.listeners[event] ??= []
    this.listeners[event].push(listener)
  }

  send() {
    queueMicrotask(() => {
      this.listeners.load?.forEach(listener => listener())
    })
  }
}

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('VideoEditorView', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        return makeJsonResponse({ data: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const originalCreateElement = document.createElement.bind(document)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName.toLowerCase() === 'video') {
        setTimeout(() => {
          element.dispatchEvent(new Event('error'))
        }, 0)
      }
      return element
    })
  })

  afterEach(() => {
    createElementSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('视频上传成功后，自动封面提取失败不应把视频上传标记为失败', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/upload', component: VideoEditorView }],
    })
    await router.push('/upload')
    await router.isReady()

    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { id: 'user-1', uuid: 'user-1', username: 'demo', role: 'user' } as never
    auth.isAuthenticated = true

    const wrapper = mount({
      template: '<router-view />',
    }, {
      global: {
        plugins: [router],
      },
    })

    await flushPromises()

    const storageSelect = wrapper.findComponent({ name: 'PSelect' })
    await storageSelect.vm.$emit('update:modelValue', 'local')
    await flushPromises()

    const fileInput = wrapper.find('input[type="file"][accept*="video/mp4"]')
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })

    await fileInput.trigger('change')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('视频已上传')
    })

    expect(wrapper.text()).not.toContain('视频上传失败')
    expect(wrapper.text()).not.toContain('无法读取视频内容')
    expect(wrapper.text()).toContain('自动封面生成失败，可手动上传封面')
  })
})
