import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import StudioContentView from '@/views/studio/StudioContentView.vue'
import StudioModuleLayout from '@/views/studio/StudioModuleLayout.vue'
import { useStudioStore } from '@/stores/studio'
import { useSiteAccessStore } from '@/stores/siteAccess'

const routes = [{
  path: '/studio/:module',
  component: StudioModuleLayout,
  children: [{ path: 'content', component: StudioContentView }],
}]

function deferred() {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('StudioContentView', () => {
  it('renders module navigation and requests route-backed content filters', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push('/studio/blog/content?q=research&status=draft&visibility=subscribers&collection_id=collection-1&issue=missing_cover&page=2')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
	useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.channels = [store.currentChannel]
    store.collections.blog = [{
      id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '研究', description: '', cover_url: '', is_default: false,
      created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
    }]

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()

    expect(wrapper.findAll('.studio-module__header nav a').map(link => link.text())).toEqual(['内容', '数据', '互动', '设置'])
    expect(store.loadContents).toHaveBeenCalledWith('blog', {
	  q: 'research', status: 'draft', visibility: 'subscribers', collection_id: 'collection-1', issue: 'missing_cover', page: 2,
    })
    expect(wrapper.find('[data-testid="create-content"]').attributes('href')).toBe('/studio/blog/new?collection=collection-1')
  })

  it('keeps filter changes in route query and omits collection for all collections', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content?collection_id=collection-1&page=3')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
	useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.collections.blog = [{
      id: 'collection-1', channel_id: 'channel-1', content_type: 'blog', name: '研究', description: '', cover_url: '', is_default: false,
      created_at: '', updated_at: '',
    }]

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.find('[data-testid="status-filter"]').setValue('published')
    await flushPromises()

    expect(router.currentRoute.value.query.status).toBe('published')
    expect(router.currentRoute.value.query.page).toBeUndefined()

    await wrapper.find('[data-testid="collection-filter"]').setValue('')
    await flushPromises()
    expect(router.currentRoute.value.query.collection_id).toBeUndefined()
    expect(wrapper.find('[data-testid="create-content"]').attributes('href')).toBe('/studio/blog/new')

    await wrapper.find('[data-testid="manage-collections"]').trigger('click')
    expect(wrapper.find('[data-testid="studio-collection-sheet"]').exists()).toBe(true)
  })

  it('loads contents and collections once when switching modules', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }

    mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    vi.mocked(store.loadContents).mockClear()
    vi.mocked(store.loadCollections).mockClear()

    await router.push('/studio/podcast/content')
    await flushPromises()

    expect(store.loadContents).toHaveBeenCalledTimes(1)
    expect(store.loadContents).toHaveBeenCalledWith('podcast', {
      q: '', status: '', visibility: '', collection_id: '', page: 1,
    })
    expect(store.loadCollections).toHaveBeenCalledTimes(1)
    expect(store.loadCollections).toHaveBeenCalledWith('podcast')
  })

  it('loads the latest module after the initial page load finishes', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    const initialContents = deferred()
    const initialCollections = deferred()
    ;(store as any).loadContents = vi.fn((currentModule: string) => currentModule === 'blog' ? initialContents.promise : Promise.resolve())
    ;(store as any).loadCollections = vi.fn((currentModule: string) => currentModule === 'blog' ? initialCollections.promise : Promise.resolve())

    mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await router.push('/studio/podcast/content')
    await flushPromises()
    initialContents.resolve()
    initialCollections.resolve()
    await flushPromises()

    expect(store.loadContents).toHaveBeenCalledTimes(2)
    expect(store.loadContents).toHaveBeenLastCalledWith('podcast', {
      q: '', status: '', visibility: '', collection_id: '', page: 1,
    })
    expect(store.loadCollections).toHaveBeenCalledTimes(2)
    expect(store.loadCollections).toHaveBeenLastCalledWith('podcast')
  })

  it('keeps loading while a newer route request is still pending after an older request finishes', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    const older = deferred()
    const newer = deferred()
    let requestCount = 0
    ;(store as any).loadContents = vi.fn(() => {
      requestCount += 1
      if (requestCount === 2) return older.promise
      if (requestCount === 3) return newer.promise
      return Promise.resolve()
    })

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await router.push('/studio/blog/content?q=older')
    await flushPromises()
    await router.push('/studio/blog/content?q=newer')
    await flushPromises()
    older.resolve()
    await flushPromises()

    expect(wrapper.text()).toContain('加载中...')

    newer.resolve()
    await flushPromises()
  })

  it('ignores an older request failure when the latest request succeeds', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    const older = deferred()
    const newer = deferred()
    let requestCount = 0
    ;(store as any).loadContents = vi.fn(() => {
      requestCount += 1
      if (requestCount === 2) return older.promise
      if (requestCount === 3) return newer.promise
      return Promise.resolve()
    })

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await router.push('/studio/blog/content?q=older')
    await flushPromises()
    await router.push('/studio/blog/content?q=newer')
    await flushPromises()
    older.reject(new Error('旧请求失败'))
    await flushPromises()

    expect(wrapper.text()).toContain('加载中...')
    expect(wrapper.text()).not.toContain('旧请求失败')

    newer.resolve()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows the error from the latest route request', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
    useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    const older = deferred()
    const newer = deferred()
    let requestCount = 0
    ;(store as any).loadContents = vi.fn(() => {
      requestCount += 1
      if (requestCount === 2) return older.promise
      if (requestCount === 3) return newer.promise
      return Promise.resolve()
    })

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await router.push('/studio/blog/content?q=older')
    await flushPromises()
    await router.push('/studio/blog/content?q=newer')
    await flushPromises()
    older.resolve()
    newer.reject(new Error('新请求失败'))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('新请求失败')
  })

  it('runs status and confirmed delete actions through the studio store', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const store = useStudioStore(pinia)
	useSiteAccessStore(pinia).isFeatureEnabled = vi.fn().mockReturnValue(true)
    store.loaded = true
    store.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    store.contents.blog = [{
      id: 'post-1', module: 'blog', channel_id: 'channel-1', title: '文章', summary: '', cover_url: '',
      status: 'published', visibility: 'public', collections: [], view_count: 0, metrics: {},
      created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
    }]
    const updateStatus = vi.fn().mockResolvedValue(undefined)
    const deleteContent = vi.fn().mockResolvedValue(undefined)
    ;(store as any).updateContentStatus = updateStatus
    ;(store as any).deleteContent = deleteContent

    const PConfirm = {
      props: ['show'], emits: ['confirm', 'cancel'],
      template: '<button v-if="show" data-testid="confirm-delete-content" @click="$emit(\'confirm\')">确认删除</button>',
    }
    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router], stubs: { PConfirm } } })
    await flushPromises()

    await wrapper.get('[data-testid="toggle-status-post-1"]').trigger('click')
    await flushPromises()
    expect(updateStatus).toHaveBeenCalledWith('blog', expect.objectContaining({ id: 'post-1' }), 'draft')

    await wrapper.get('[data-testid="delete-post-1"]').trigger('click')
    await wrapper.get('[data-testid="confirm-delete-content"]').trigger('click')
    await flushPromises()
    expect(deleteContent).toHaveBeenCalledWith('blog', 'post-1')
  })

  it('hides create when the module publishing feature is disabled', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/studio/blog/content')
    await router.isReady()
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true })
    const studio = useStudioStore(pinia)
    studio.loaded = true
    studio.currentChannel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
    const access = useSiteAccessStore(pinia)
	access.isFeatureEnabled = vi.fn().mockReturnValue(false)

    const wrapper = mount(StudioModuleLayout, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="create-content"]').exists()).toBe(false)
  })
})
