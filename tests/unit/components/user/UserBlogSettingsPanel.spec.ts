import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import UserBlogSettingsPanel from '@/components/user/UserBlogSettingsPanel.vue'
import { useAuthStore } from '@/stores/auth'

const PSheetStub = defineComponent({
  name: 'PSheet',
  props: ['side', 'mode', 'partialWidth'],
  template: '<section data-testid="user-right-sheet" :data-side="side" :data-mode="mode" :data-partial-width="partialWidth"><slot /></section>',
})

describe('UserBlogSettingsPanel', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = { username: 'alice', email: 'alice@example.com' }
    authStore.token = 'token'
    authStore.isAuthenticated = true
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps the profile form unavailable until profile data loads', async () => {
    let resolveProfile!: (response: Response) => void
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/users/me')) {
        return new Promise<Response>((resolve) => { resolveProfile = resolve })
      }
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })
    const wrapper = mount(UserBlogSettingsPanel, {
      props: { includeAccountExtras: false },
      global: { stubs: { PModal: { template: '<div><slot /></div>' }, PSheet: PSheetStub } },
    })
    expect(wrapper.find('[data-test="profile-settings-loading"]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)

    resolveProfile(new Response(JSON.stringify({ data: { display_name: 'Alice' } }), { status: 200 }))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalled()
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.get('input[placeholder="用于展示的名称"]').element).not.toHaveProperty('disabled', true)
  })

  it('shows a retry action instead of an empty form when loading fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/users/me')) return new Response(null, { status: 503 })
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })
    const wrapper = mount(UserBlogSettingsPanel, {
      props: { includeAccountExtras: false },
      global: { stubs: { PModal: { template: '<div><slot /></div>' }, PSheet: PSheetStub } },
    })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('资料加载失败')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('button').text()).toContain('重试')
  })

  it('只显示保留的资料字段，并在保存时忽略已移除字段', async () => {
    let profileUpdateBody: Record<string, unknown> | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/users/me') && init?.method === 'PUT') {
        profileUpdateBody = JSON.parse(String(init.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ data: { display_name: 'New name', bio: 'New bio' } }), { status: 200 })
      }
      if (url.endsWith('/users/me')) {
        return new Response(JSON.stringify({
          data: {
            display_name: 'Alice',
            bio: 'Old bio',
            website: 'https://example.com',
            location: 'Shanghai',
          },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })

    const wrapper = mount(UserBlogSettingsPanel, {
      props: { includeAccountExtras: false },
      global: { stubs: { PModal: { template: '<div><slot /></div>' }, PSheet: PSheetStub } },
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('个人网站')
    expect(wrapper.text()).not.toContain('所在地')
    expect(wrapper.get('input[placeholder="用于展示的名称"]').attributes('maxlength')).toBe('50')
    expect(wrapper.get('textarea[placeholder="介绍一下自己..."]').attributes('maxlength')).toBe('200')
    expect(wrapper.text()).toContain('7 / 200')

    await wrapper.get('input[placeholder="用于展示的名称"]').setValue('  New name  ')
    await wrapper.get('textarea[placeholder="介绍一下自己..."]').setValue('New bio')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(profileUpdateBody).toEqual({ display_name: 'New name', bio: 'New bio' })
  })

  it('头像上传成功后立即绑定到用户资料并同步认证用户', async () => {
    const profileUpdateBodies: Record<string, unknown>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/users/me') && init?.method === 'PUT') {
        profileUpdateBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return new Response(JSON.stringify({ data: { avatar_url: 'https://cdn.example.com/avatar.png' } }), { status: 200 })
      }
      if (url.endsWith('/users/me')) {
        return new Response(JSON.stringify({ data: { display_name: 'Alice', bio: '' } }), { status: 200 })
      }
      if (url.endsWith('/uploads')) {
        return new Response(JSON.stringify({ data: { url: 'https://cdn.example.com/avatar.png' } }), { status: 201 })
      }
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })

    const wrapper = mount(UserBlogSettingsPanel, {
      props: { includeAccountExtras: false },
      global: { stubs: { PModal: { template: '<div><slot /></div>' }, PSheet: PSheetStub } },
    })
    await flushPromises()
    await wrapper.get('.avatar-field button').trigger('click')
    expect(wrapper.findComponent(PSheetStub).props('side')).toBe('right')
    expect(wrapper.findComponent(PSheetStub).props('mode')).toBe('partial')
    const input = wrapper.get('[data-testid="profile-avatar-input"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['avatar'], 'avatar.png', { type: 'image/png' })],
    })

    await input.trigger('change')
    await flushPromises()

    expect(profileUpdateBodies).toEqual([{ avatar_url: 'https://cdn.example.com/avatar.png' }])
    expect(useAuthStore().user?.avatar_url).toBe('https://cdn.example.com/avatar.png')
  })

  it('个人主页预览使用正常宽度的右侧面板', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/users/me')) {
        return new Response(JSON.stringify({ data: { display_name: 'Alice', bio: '个人简介' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })

    const wrapper = mount(UserBlogSettingsPanel, {
      props: { includeAccountExtras: false },
      global: { stubs: { PSheet: PSheetStub } },
    })
    await flushPromises()

    const previewButton = wrapper.findAll('button').find((button) => button.text().includes('查看个人主页'))
    expect(previewButton).toBeDefined()
    await previewButton!.trigger('click')

    const sheet = wrapper.findComponent(PSheetStub)
    expect(sheet.props('side')).toBe('right')
    expect(sheet.props('mode')).toBe('partial')
    expect(sheet.props('partialWidth')).toBe('var(--a-recommendation-width)')
  })

  it('按头像、基本信息、主页预览的顺序排列资料设置', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/users/me')) {
        return new Response(JSON.stringify({ data: { display_name: 'Alice', bio: '个人简介' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: { available: false } }), { status: 200 })
    })

    const wrapper = mount(UserBlogSettingsPanel, {
      props: { includeAccountExtras: false },
      global: { stubs: { PSheet: PSheetStub } },
    })
    await flushPromises()

    const rows = wrapper.findAll('.settings-block')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('头像')
    expect(rows[0]!.text()).not.toContain('显示名称')
    expect(rows[1]!.text()).toContain('基本信息')
    expect(rows[1]!.text()).toContain('显示名称')
    expect(rows[2]!.text()).toContain('主页预览')
    expect(rows[2]!.text()).not.toContain('个人简介')
  })
})
