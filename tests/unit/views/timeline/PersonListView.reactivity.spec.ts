import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import PersonListView from '@/views/timeline/PersonListView.vue'
import { useTimelineStore } from '@/stores/timeline'
import type { TimelinePerson } from '@/types'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

const stubs = {
  PPageHeader: { template: '<header><slot name="action" /></header>' },
  PButton: { template: '<button><slot /></button>' },
  PInput: { template: '<input />' },
  PTextarea: { template: '<textarea />' },
  PModal: { template: '<div><slot /><slot name="footer" /></div>' },
  PConfirm: { template: '<div />' },
  PEmpty: { props: ['text'], template: '<div class="empty">{{ text }}</div>' },
  PEntry: { template: '<article><slot name="meta" /><slot name="title" /><slot name="summary" /><slot name="actions" /></article>' },
}

describe('PersonListView timeline store reactivity', () => {
  it('updates rendered persons when the setup store state changes after mount', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(PersonListView, {
      global: {
        plugins: [pinia, router],
        stubs,
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('暂无历史人物')

    const store = useTimelineStore()
    store.persons = [{
      id: 'person-1',
      user_id: 'user-1',
      name: 'Ada Lovelace',
      bio: 'Mathematician',
      tags: ['math'],
    } as TimelinePerson]
    await nextTick()

    expect(wrapper.text()).toContain('Ada Lovelace')
  })
})
