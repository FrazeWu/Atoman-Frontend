import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: mockComments }),
  }))
})

describe('VideoCommentSection', () => {
  it('renders timestamp label before comment content', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(VideoCommentSection, {
      props: { videoId: 'video-1' },
      global: {
        stubs: {
          RouterLink: true,
          AConfirm: true,
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
          AConfirm: true,
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
          AConfirm: true,
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
