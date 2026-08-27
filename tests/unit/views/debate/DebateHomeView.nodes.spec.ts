import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDebateStore } from '@/stores/debate'
import type { Debate } from '@/types'
import DebateHomeView from '@/views/debate/DebateHomeView.vue'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPush }) }))

const debateRow = {
  id: 'debate-1', user_id: 'user-1', user: { username: 'fafa', email: 'fafa@example.com' },
  title: '长期吸烟会不会显著增加肺癌风险？', description: '', content: '',
  status: 'active', tags: [], view_count: 2, current_revision_id: 'revision-debate-1', references: [],
  conclusion_type: 'yes', created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
} satisfies Debate

let createResponse: Record<string, unknown>

function mountView() {
  return shallowMount(DebateHomeView, {
    global: {
      stubs: {
        PPageHeader: { template: '<header><slot name="action" /></header>' },
        PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        PContentProgress: { template: '<div><slot /></div>' },
        PContentCard: { template: '<article><slot /><slot name="meta" /><slot name="title" /><slot name="summary" /><slot name="actions" /></article>' },
        PInteractionCard: { template: '<article class="debate-card-stub"><slot /></article>' },
        PSelect: {
          props: ['options'],
          template: `
            <select data-test="status-filter">
              <option
                v-for="option in options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          `,
        },
        PInput: {
          props: ['modelValue', 'label'],
          emits: ['update:modelValue'],
          template: '<label>{{ label }}<input :data-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></label>',
        },
        PReferenceField: {
          props: ['modelValue', 'label'],
          emits: ['update:modelValue'],
          template: '<label>{{ label }}<textarea :data-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></label>',
        },
        PEmpty: true,
        PModal: { template: '<div><slot /></div>' },
      },
    },
  })
}

async function openCreateForm(wrapper: ReturnType<typeof mountView>) {
  await wrapper.findAll('button').find(button => button.text() === '发起辩题')!.trigger('click')
}

describe('DebateHomeView node wording', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.isAuthenticated = true
    routerPush.mockReset()
    createResponse = {
      ...debateRow,
      id: 'debate-created',
      current_revision_id: 'revision-1',
    }
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ data: createResponse }), { status: 201 })
      }
      return new Response(JSON.stringify({
        data: [debateRow],
        meta: { total: 1 },
      }), { status: 200 })
    })
  })

  it('treats every item as a debate node and uses the unified conclusion stamp', async () => {
    const store = useDebateStore()
    store.debates = [debateRow]
    store.debatesTotal = 1
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('发起辩题')
    expect(wrapper.text()).toContain('结论 · 是')
    expect(wrapper.findAll('[data-test="status-filter"] option').map(option => ({
      label: option.text(),
      value: option.attributes('value'),
    }))).toEqual([
      { label: '全部状态', value: '' },
      { label: '开放', value: 'active' },
      { label: '已归档', value: 'archived' },
    ])
    expect(wrapper.text()).not.toContain('已结题')
    expect(wrapper.text()).not.toContain('进行中')
    expect(wrapper.text()).not.toContain('论点 9')
    expect(wrapper.text()).not.toContain('发起辩论')
  })

  it('创建时只提交标题、正文、标签并用空描述', async () => {
    const wrapper = mountView()
    await flushPromises()
    await openCreateForm(wrapper)

    expect(wrapper.find('[data-label="描述"]').exists()).toBe(false)
    await wrapper.get('[data-label="标题"]').setValue('每周运动会不会降低心血管疾病风险？')
    await wrapper.get('[data-label="正文"]').setValue('汇总随机试验和队列研究。')
    await wrapper.get('[data-label="标签（逗号分隔）"]').setValue('健康, 运动')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const postCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      title: '每周运动会不会降低心血管疾病风险？',
      description: '',
      content: '汇总随机试验和队列研究。',
      tags: ['健康', '运动'],
    })
    expect(routerPush).toHaveBeenCalledWith('/debate/debate-created')
  })

  it('创建响应缺少当前版本时不进入详情', async () => {
    createResponse = { ...debateRow, id: 'debate-created', current_revision_id: undefined }
    const wrapper = mountView()
    await flushPromises()
    await openCreateForm(wrapper)
    await wrapper.get('[data-label="标题"]').setValue('新的辩题')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(routerPush).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('创建失败，请重试')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
