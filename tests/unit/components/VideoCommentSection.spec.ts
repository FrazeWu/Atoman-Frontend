import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VideoCommentSection from '@/components/video/VideoCommentSection.vue'
import { useAuthStore } from '@/stores/auth'

const mockComments = [
  {
    id: '1',
    user_id: 'u1',
    user: { username: 'alice', display_name: 'Alice' },
    content: 'great video',
    timestamp_sec: null,
    status: 'visible',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: 'u2',
    user: { username: 'bob', display_name: 'Bob' },
    content: 'this part!',
    timestamp_sec: 92,
    status: 'visible',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const commentResponse = (id: string, content: string) => ({
  ok: true,
  json: async () => ({
    data: [{
      id,
      user_id: 'u1',
      user: { username: 'alice', display_name: 'Alice' },
      content,
      timestamp_sec: null,
      status: 'visible',
      created_at: '2026-07-15T00:00:00Z',
      updated_at: '2026-07-15T00:00:00Z',
    }],
  }),
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: mockComments }),
  }))
})

describe('VideoCommentSection', () => {
  it('does not let a previous video submit clear the current draft or refetch the current video', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'u1', username: 'alice', email: 'a@example.com' }
    authStore.isAuthenticated = true
    const post = deferred<{ ok: boolean }>()
    let currentVideoGets = 0
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return post.promise
      if (String(input).endsWith('/videos/video-b/comments')) currentVideoGets += 1
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()
    wrapper.vm.$.setupState.newComment = '视频 A 草稿'
    const firstSubmit = wrapper.vm.$.setupState.submitComment()
    const repeatedSubmit = wrapper.vm.$.setupState.submitComment()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)

    await wrapper.setProps({ videoId: 'video-b' })
    wrapper.vm.$.setupState.newComment = '视频 B 草稿'
    post.resolve({ ok: true })
    await Promise.all([firstSubmit, repeatedSubmit])
    await flushPromises()

    expect(wrapper.vm.$.setupState.newComment).toBe('视频 B 草稿')
    expect(currentVideoGets).toBe(1)
  })

  it('does not refetch comments after a submit completes on an unmounted component', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'u1' } as typeof authStore.user
    authStore.isAuthenticated = true
    const post = deferred<{ ok: boolean }>()
    let getCalls = 0
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => {
      if (init?.method === 'POST') return post.promise
      getCalls += 1
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    }))

    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()
    wrapper.vm.$.setupState.newComment = '待提交'
    const submitting = wrapper.vm.$.setupState.submitComment()
    wrapper.unmount()
    post.resolve({ ok: true })
    await submitting

    expect(getCalls).toBe(1)
  })

  it('keeps the comment draft and does not refetch when submit returns non-2xx', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'u1' } as typeof authStore.user
    authStore.isAuthenticated = true
    let getCalls = 0
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve({ ok: false })
      getCalls += 1
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    }))
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()

    wrapper.vm.$.setupState.newComment = '需要保留的草稿'
    await wrapper.vm.$.setupState.submitComment()

    expect(wrapper.vm.$.setupState.newComment).toBe('需要保留的草稿')
    expect(wrapper.vm.$.setupState.submitting).toBe(false)
    expect(getCalls).toBe(1)
  })

  it('clears a previous video delete confirmation before it can delete', async () => {
    setActivePinia(createPinia())
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()

    wrapper.vm.$.setupState.requestDelete('comment-a')
    await wrapper.setProps({ videoId: 'video-b' })
    await wrapper.vm.$.setupState.confirmDelete()

    expect(wrapper.vm.$.setupState.showDeleteConfirm).toBe(false)
    expect(wrapper.vm.$.setupState.pendingDeleteId).toBeNull()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0)
  })

  it('does not refetch the current video when a previous video delete finishes', async () => {
    setActivePinia(createPinia())
    const deletion = deferred<{ ok: boolean }>()
    let currentVideoGets = 0
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') return deletion.promise
      if (String(input).endsWith('/videos/video-b/comments')) currentVideoGets += 1
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()

    wrapper.vm.$.setupState.requestDelete('comment-a')
    const deleting = wrapper.vm.$.setupState.confirmDelete()
    await wrapper.setProps({ videoId: 'video-b' })
    deletion.resolve({ ok: true })
    await deleting
    await flushPromises()

    expect(currentVideoGets).toBe(1)
  })

  it('does not refetch comments after a delete completes on an unmounted component', async () => {
    setActivePinia(createPinia())
    const deletion = deferred<{ ok: boolean }>()
    let getCalls = 0
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => {
      if (init?.method === 'DELETE') return deletion.promise
      getCalls += 1
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    }))
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()

    wrapper.vm.$.setupState.requestDelete('comment-a')
    const deleting = wrapper.vm.$.setupState.confirmDelete()
    wrapper.unmount()
    deletion.resolve({ ok: true })
    await deleting

    expect(getCalls).toBe(1)
  })

  it('keeps delete confirmation on non-2xx and ignores repeated confirmation while pending', async () => {
    setActivePinia(createPinia())
    const deletion = deferred<{ ok: boolean }>()
    const fetchMock = vi.fn((_input, init?: RequestInit) => (
      init?.method === 'DELETE'
        ? deletion.promise
        : Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()

    wrapper.vm.$.setupState.requestDelete('comment-a')
    const first = wrapper.vm.$.setupState.confirmDelete()
    const repeated = wrapper.vm.$.setupState.confirmDelete()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    deletion.resolve({ ok: false })
    await Promise.all([first, repeated])

    expect(wrapper.vm.$.setupState.showDeleteConfirm).toBe(true)
    expect(wrapper.vm.$.setupState.pendingDeleteId).toBe('comment-a')
  })

  it('ignores cancel and modal close while deleting, then refreshes after success', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'u1' } as typeof authStore.user
    authStore.isAuthenticated = true
    const deletion = deferred<{ ok: boolean }>()
    let getCalls = 0
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => {
      if (init?.method === 'DELETE') return deletion.promise
      getCalls += 1
      return Promise.resolve({ ok: true, json: async () => ({ data: mockComments }) })
    }))
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()
    await wrapper.find('.vcs-delete').trigger('click')

    const modal = document.body.querySelector('.p-modal')!
    const footerButtons = [...modal.querySelectorAll<HTMLButtonElement>('.p-modal-footer button')]
    footerButtons[1].click()
    await wrapper.vm.$nextTick()

    expect(footerButtons[0].disabled).toBe(true)
    footerButtons[0].click()
    ;(modal.querySelector('.p-modal-close') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.$.setupState.showDeleteConfirm).toBe(true)

    deletion.resolve({ ok: true })
    await flushPromises()

    expect(getCalls).toBe(2)
    expect(wrapper.vm.$.setupState.showDeleteConfirm).toBe(false)
    wrapper.unmount()
  })

  it('allows closing delete confirmation after a failed request settles', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'u1' } as typeof authStore.user
    authStore.isAuthenticated = true
    const deletion = deferred<{ ok: boolean }>()
    vi.stubGlobal('fetch', vi.fn((_input, init?: RequestInit) => (
      init?.method === 'DELETE'
        ? deletion.promise
        : Promise.resolve({ ok: true, json: async () => ({ data: mockComments }) })
    )))
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()
    await wrapper.find('.vcs-delete').trigger('click')

    const modal = document.body.querySelector('.p-modal')!
    const footerButtons = [...modal.querySelectorAll<HTMLButtonElement>('.p-modal-footer button')]
    footerButtons[1].click()
    await wrapper.vm.$nextTick()
    expect(footerButtons[0].disabled).toBe(true)

    deletion.resolve({ ok: false })
    await flushPromises()

    const settledCancel = document.body.querySelector<HTMLButtonElement>('.p-modal-footer button')!
    expect(settledCancel.disabled).toBe(false)
    settledCancel.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.$.setupState.showDeleteConfirm).toBe(false)
    wrapper.unmount()
  })

  it('keeps loading the current video when the previous video comments return first', async () => {
    setActivePinia(createPinia())
    const first = deferred<ReturnType<typeof commentResponse>>()
    const second = deferred<ReturnType<typeof commentResponse>>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/videos/video-a/comments') ? first.promise : second.promise
    )))

    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await wrapper.setProps({ videoId: 'video-b' })

    first.resolve(commentResponse('comment-a', '视频 A 评论'))
    await flushPromises()

    expect(wrapper.find('.vcs-loading').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('视频 A 评论')

    second.resolve(commentResponse('comment-b', '视频 B 评论'))
    await flushPromises()
    expect(wrapper.text()).toContain('视频 B 评论')
  })

  it('does not let previous video comments overwrite the current video', async () => {
    setActivePinia(createPinia())
    const first = deferred<ReturnType<typeof commentResponse>>()
    const second = deferred<ReturnType<typeof commentResponse>>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/videos/video-a/comments') ? first.promise : second.promise
    )))

    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await wrapper.setProps({ videoId: 'video-b' })

    second.resolve(commentResponse('comment-b', '视频 B 评论'))
    await flushPromises()
    expect(wrapper.text()).toContain('视频 B 评论')

    first.resolve(commentResponse('comment-a', '视频 A 评论'))
    await flushPromises()
    expect(wrapper.text()).toContain('视频 B 评论')
    expect(wrapper.text()).not.toContain('视频 A 评论')
  })

  it('does not show the previous video comments when the current video request fails', async () => {
    setActivePinia(createPinia())
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(commentResponse('comment-a', '视频 A 评论'))
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'failed' }) })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-a' },
      global: { stubs: { RouterLink: true, PModal: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('视频 A 评论')

    await wrapper.setProps({ videoId: 'video-b' })
    await flushPromises()

    expect(wrapper.text()).not.toContain('视频 A 评论')
    expect(wrapper.text()).toContain('还没有评论')
  })

  it('renders timestamp label before comment content', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-1' },
      global: {
        stubs: {
          RouterLink: true,
          PModal: true,
        },
      },
    })
    // wait for onMounted fetch
    await new Promise(r => setTimeout(r, 10))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('01:32')
    expect(wrapper.text()).toContain('this part!')
  })

  it('emits seekToTimestamp when timestamp chip is clicked', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-1' },
      global: {
        stubs: {
          RouterLink: true,
          PModal: true,
        },
      },
    })
    await new Promise(r => setTimeout(r, 10))
    await wrapper.vm.$nextTick()

    const tsButton = wrapper.find('.vcs-ts-label')
    expect(tsButton.exists()).toBe(true)
    await tsButton.trigger('click')
    expect(wrapper.emitted('seekToTimestamp')).toBeTruthy()
    expect(wrapper.emitted('seekToTimestamp')![0]).toEqual([92])
  })

  it('extracts timestamp from comment text when submitting', async () => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { uuid: 'u1', username: 'alice', email: 'a@example.com' }
    authStore.isAuthenticated = true

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-1' },
      global: {
        stubs: {
          RouterLink: true,
          PModal: true,
        },
      },
    })
    await new Promise(r => setTimeout(r, 10))
    await wrapper.vm.$nextTick()

    await wrapper.find('textarea').setValue('12:34 这里开始')
    await wrapper.find('.vcs-submit').trigger('click')

    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(postCall).toBeTruthy()
    expect(JSON.parse(postCall![1].body)).toMatchObject({
      content: '12:34 这里开始',
      timestamp_sec: 754,
    })
  })
})
