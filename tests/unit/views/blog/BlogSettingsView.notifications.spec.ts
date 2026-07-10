import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BlogSettingsView from '@/views/blog/BlogSettingsView.vue'

describe('BlogSettingsView notification settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }))
  })

  it('shows notification and blocked user settings', () => {
    const wrapper = mount(BlogSettingsView, {
      global: {
        stubs: {
          PButton: { template: '<button><slot /></button>' },
          PSelect: { props: ['options'], template: '<div>{{ options.map(item => item.label).join(" ") }}</div>' },
        },
      },
    })
    expect(wrapper.text()).toContain('通知设置')
    expect(wrapper.text()).toContain('已拉黑用户')
    expect(wrapper.text()).toContain('陌生人仅可发一条')
  })
})
