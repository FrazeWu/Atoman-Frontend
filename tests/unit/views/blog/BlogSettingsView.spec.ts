import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogSettingsView from '@/views/blog/BlogSettingsView.vue'
import { useAuthStore } from '@/stores/auth'

const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('BlogSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo', email: 'demo@example.com' }
    auth.isAuthenticated = true
  })

  it('不展示后端不支持的密码修改控件', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/users/me/settings')) return jsonResponse({ data: { dm_permission: 'anyone' } })
      if (url.endsWith('/users/me')) return jsonResponse({ data: { display_name: 'Demo' } })
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mount(BlogSettingsView)
    await flushPromises()

    expect(wrapper.text()).not.toContain('修改密码')
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
  })

  it('私信设置保存失败时不继续提交资料并显示错误', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!init?.method && url.endsWith('/users/me/settings')) {
        return jsonResponse({ data: { dm_permission: 'anyone' } })
      }
      if (!init?.method && url.endsWith('/users/me')) {
        return jsonResponse({ data: { display_name: 'Demo' } })
      }
      if (init?.method === 'PUT' && url.endsWith('/users/me/settings')) {
        return jsonResponse({ error: 'Invalid dm_permission' }, 400)
      }
      if (init?.method === 'PUT' && url.endsWith('/users/me')) {
        return jsonResponse({ data: {} })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(BlogSettingsView)
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/me$/),
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(wrapper.text()).toContain('Invalid dm_permission')
    expect(wrapper.text()).not.toContain('保存成功')
  })
})
