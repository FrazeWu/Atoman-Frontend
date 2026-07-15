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

function mountCommentSection(commentMode: 'all' | 'authenticated' | 'disabled') {
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
        PConfirm: true,
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

  it('postId 变化时清空旧状态并只显示新文章评论', async () => {
    const authStore = useAuthStore()
    authStore.user = { uuid: 'user-1', username: 'owner', email: 'owner@example.com' }
    fetchMock.mockImplementation((url: string) => Promise.resolve({
      ok: true,
      json: async () => ({
        data: String(url).includes('post-1')
          ? [{ id: 'comment-1', post_id: 'post-1', user_id: 'user-1', content: '旧文章评论', guest_name: '甲', created_at: '2026-01-01T00:00:00Z' }]
          : [{ id: 'comment-2', post_id: 'post-2', content: '新文章评论', guest_name: '乙', created_at: '2026-01-02T00:00:00Z' }],
      }),
    }))
    const wrapper = mountCommentSection('all')
    await flushPromises()
    await wrapper.get('textarea').setValue('尚未提交的内容')
    await wrapper.get('#guest-name').setValue('临时名字')
    await wrapper.get('.delete-btn').trigger('click')

    await wrapper.setProps({ postId: 'post-2' })
    await flushPromises()

    expect(wrapper.text()).toContain('新文章评论')
    expect(wrapper.text()).not.toContain('旧文章评论')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.get('#guest-name').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findComponent({ name: 'PConfirm' }).props('show')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
