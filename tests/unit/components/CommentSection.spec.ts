import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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
        AConfirm: true,
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
})
