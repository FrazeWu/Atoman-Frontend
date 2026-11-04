import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import ForumNewTopicView from '@/views/forum/ForumNewTopicView.vue'
import { useForumStore } from '@/stores/forum'
import { useAuthStore } from '@/stores/auth'

const PEditorStub = defineComponent({
  name: 'PEditor',
  props: {
    modelValue: String,
    mode: String,
    enableMentions: Boolean,
    enableEmbeds: Boolean,
    showModeToggle: Boolean,
    showSyncScrollToggle: Boolean,
    syncScroll: Boolean,
    placeholder: String,
  },
  setup(props) {
    return () => h('div', { 'data-test': 'editor-stub', 'data-enable-embeds': String(props.enableEmbeds) })
  },
})

describe('ForumNewTopicView embeds integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('enables media embeds on PEditor for inserting music cards', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/forum/new', component: ForumNewTopicView }],
    })
    await router.push('/forum/new')

    const authStore = useAuthStore()
    authStore.isAuthenticated = true
    authStore.token = 'test-token'
    authStore.user = { uuid: 'u1', username: 'tester', email: 'test@example.com' }

    const forumStore = useForumStore()
    forumStore.categoriesLoaded = true
    forumStore.categories = [{ id: 'cat-1', name: 'General', created_at: '' }]
    vi.spyOn(forumStore, 'fetchDraft').mockResolvedValue(null)

    const wrapper = mount(ForumNewTopicView, {
      global: {
        plugins: [router],
        stubs: {
          PEditor: PEditorStub,
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PButton: { template: '<button><slot /></button>' },
          PToast: true,
          RouterLink: true,
        },
      },
    })

    const editor = wrapper.findComponent(PEditorStub)
    expect(editor.exists()).toBe(true)
    expect(editor.props('enableEmbeds')).toBe(true)
  })
})
