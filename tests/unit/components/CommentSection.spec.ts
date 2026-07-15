import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CommentSection from '@/components/blog/CommentSection.vue'
import { useAuthStore } from '@/stores/auth'

const fetchMock = vi.fn()

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  })
  vi.stubGlobal('fetch', fetchMock)

  const authStore = useAuthStore()
  authStore.token = null
  authStore.user = null
  authStore.isAuthenticated = false
})

function mountCommentSection(commentMode: 'all' | 'authenticated' | 'disabled', stubConfirm = true) {
  return mount(CommentSection, {
    props: {
      postId: 'post-1',
      allowComments: true,
      commentMode,
    },
    global: {
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>',
        },
        PConfirm: stubConfirm
          ? true
          : {
              props: ['show', 'message', 'confirmText'],
              emits: ['confirm', 'cancel'],
              template: '<div v-if="show" data-test="delete-confirm"><p data-test="delete-error">{{ message }}</p><button data-test="confirm-delete" @click="$emit(\'confirm\')">{{ confirmText }}</button></div>',
            },
      },
    },
  })
}

describe('CommentSection', () => {
  it('在 disabled 模式下显示关闭提示并隐藏表单', async () => {
    const wrapper = mountCommentSection('disabled')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('评论已关闭')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('登录')
  })

  it('在 authenticated 模式下对游客显示登录提示', async () => {
    const wrapper = mountCommentSection('authenticated')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('登录')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('#guest-name').exists()).toBe(false)
  })

  it('在 all 模式下对游客显示匿名评论表单，且 guest_name 为空时不能提交', async () => {
    const wrapper = mountCommentSection('all')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#guest-name').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(true)

    await wrapper.find('textarea').setValue('匿名评论内容')
    const submitButton = wrapper.find('.submit-btn')
    expect((submitButton.element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('#guest-name').setValue('路人甲')
    expect((submitButton.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('删除请求失败时保留评论和确认框，并在重试发起时清除旧错误', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1', role: 'user' } as never
    authStore.isAuthenticated = true
    let resolveRetry!: (response: { ok: boolean }) => void
    const retryResponse = new Promise<{ ok: boolean }>((resolve) => {
      resolveRetry = resolve
    })
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'comment-1', user_id: 'user-1', content: '需要保留的评论', created_at: '2026-07-15T00:00:00Z' }],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockImplementationOnce(() => retryResponse)

    const wrapper = mountCommentSection('authenticated', false)
    await flushPromises()
    await wrapper.get('.delete-btn').trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('需要保留的评论')
    expect(wrapper.find('[data-test="delete-confirm"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="delete-error"]').text()).toBe('删除失败')

    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-test="delete-error"]').text()).toBe('确定删除这条评论吗？')

    resolveRetry({ ok: false })
    await flushPromises()
  })

  it.each([
    ['成功', true],
    ['失败', false],
  ])('旧删除请求%s时不影响新打开的确认会话，且同一请求不能重复提交', async (_label, oldRequestOK) => {
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'user-1', role: 'user' } as never
    authStore.isAuthenticated = true
    const comments = [
      { id: 'comment-1', user_id: 'user-1', content: '第一条评论', created_at: '2026-07-15T00:00:00Z' },
      { id: 'comment-2', user_id: 'user-1', content: '第二条评论', created_at: '2026-07-15T00:00:00Z' },
    ]
    let resolveOldRequest!: (response: { ok: boolean }) => void
    const oldRequest = new Promise<{ ok: boolean }>((resolve) => {
      resolveOldRequest = resolve
    })
    fetchMock.mockImplementation((_input, init?: RequestInit) => {
      if (init?.method === 'DELETE') return oldRequest
      return Promise.resolve({ ok: true, json: async () => ({ data: comments }) })
    })

    const wrapper = mountCommentSection('authenticated', false)
    await flushPromises()
    await wrapper.findAll('.delete-btn')[0].trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    expect(wrapper.get('[data-test="confirm-delete"]').text()).toBe('删除中...')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')

    const deleteCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')
    expect.soft(deleteCalls).toHaveLength(1)

    await wrapper.findAll('.delete-btn')[1].trigger('click')
    resolveOldRequest({ ok: oldRequestOK })
    await flushPromises()

    expect(wrapper.find('[data-test="delete-confirm"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="delete-error"]').text()).toBe('确定删除这条评论吗？')
  })
})
