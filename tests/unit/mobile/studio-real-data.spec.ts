import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StudioMobileView from '@/../apps/mobile/views/studio/StudioMobileView.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'

const mockPush = vi.fn()
let currentQueryTab: string | undefined = undefined

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useRoute: () => ({
    query: { tab: currentQueryTab },
    path: '/studio',
  }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

describe('Studio Mobile Real Data & Tab Navigation', () => {
  let pinia: ReturnType<typeof createPinia>

  function createSampleDrafts() {
    return [
      {
        id: 'draft-1',
        title: '移动端手势与纯白极简规范',
        type: 'post' as const,
        updatedAt: '2 小时前',
      },
      {
        id: 'draft-2',
        title: '周末闲谈短记',
        type: 'note' as const,
        updatedAt: '昨天',
      },
    ]
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockPush.mockReset()
    currentQueryTab = undefined

    const studioStore = useStudioStore()
    studioStore.loadState = vi.fn().mockResolvedValue(undefined)
    studioStore.loadContents = vi.fn().mockResolvedValue(undefined)
    studioStore.deleteContent = vi.fn().mockResolvedValue(undefined)
  })

  it('renders quick action buttons and drafts on default content tab', async () => {
    const wrapper = mount(StudioMobileView, {
      props: { initialDrafts: createSampleDrafts() },
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('发布短记')
    expect(wrapper.text()).toContain('撰写长文')
    expect(wrapper.text()).not.toContain('上传单曲/播客') // Mobile Studio intentionally has no upload action
    expect(wrapper.text()).toContain('移动端手势与纯白极简规范')
    expect(wrapper.findAll('[data-testid="draft-item"]').length).toBe(2)
  })

  it('navigates to create views when quick action cards are clicked', async () => {
    const wrapper = mount(StudioMobileView, {
      props: { initialDrafts: createSampleDrafts() },
      global: { plugins: [pinia] },
    })

    const noteBtn = wrapper.find('[data-testid="studio-action-note"]')
    await noteBtn.trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/posts/notes/new')

    const postBtn = wrapper.find('[data-testid="studio-action-post"]')
    await postBtn.trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/posts/new')
  })

  it('deleting a draft removes it optimistically and calls studioStore.deleteContent', async () => {
    const studioStore = useStudioStore()
    const wrapper = mount(StudioMobileView, {
      props: { initialDrafts: createSampleDrafts() },
      global: { plugins: [pinia] },
    })

    const deleteBtns = wrapper.findAll('[data-testid="draft-delete-btn"]')
    await deleteBtns[0].trigger('click')

    expect(wrapper.findAll('[data-testid="draft-item"]').length).toBe(1)
    expect(wrapper.text()).not.toContain('移动端手势与纯白极简规范')
    expect(studioStore.deleteContent).toHaveBeenCalledWith('blog', 'draft-1')
  })

  it('renders drafts tab when route query tab=drafts', async () => {
    currentQueryTab = 'drafts'
    const wrapper = mount(StudioMobileView, {
      props: { initialDrafts: createSampleDrafts() },
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('草稿箱')
    expect(wrapper.text()).toContain('全部草稿')
    expect(wrapper.findAll('[data-testid="draft-item"]').length).toBe(2)
  })

  it('renders analytics metrics when route query tab=analytics', async () => {
    currentQueryTab = 'analytics'
    const studioStore = useStudioStore()
    studioStore.dashboard = {
      channel_subscriber_count: 512,
      sections: [
        {
          module: 'blog',
          metrics: { likes: 128 },
          recent: [],
          issues: [],
        },
      ],
    } as any
    studioStore.currentChannel = {
      name: '极简设计频道',
      description: '记录关于界面与体验的深度思考',
      subscriber_count: 512,
    } as any

    const wrapper = mount(StudioMobileView, {
      props: { initialDrafts: createSampleDrafts() },
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('创作者数据')
    expect(wrapper.text()).toContain('数据概览')
    expect(wrapper.text()).toContain('128')
    expect(wrapper.text()).toContain('512')
    expect(wrapper.text()).toContain('极简设计频道')
  })

  it('renders guest card when unauthenticated and initialDrafts is not provided', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    authStore.user = null

    const wrapper = mount(StudioMobileView, {
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('登录进入 Studio')
  })
})
