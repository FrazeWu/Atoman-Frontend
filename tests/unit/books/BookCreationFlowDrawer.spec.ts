import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookCreationFlowDrawer from '@/components/books/BookCreationFlowDrawer.vue'
import * as booksApi from '@/api/books'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    token: 'fake-token',
    user: { id: 'u1', username: 'testuser' },
  }),
}))

vi.mock('@/api/books', () => ({
  uploadBookFile: vi.fn(),
  createPublicBook: vi.fn(),
}))

describe('BookCreationFlowDrawer', () => {
  beforeEach(() => {
    vi.mocked(booksApi.uploadBookFile).mockResolvedValue({
      id: 'import-123',
      asset_id: 'asset-123',
      status: 'scanning',
    } as any)
    vi.mocked(booksApi.createPublicBook).mockResolvedValue({ id: 'work-123' } as any)
  })
  it('renders correctly when open with initial step 1', () => {
    const wrapper = mount(BookCreationFlowDrawer, {
      props: {
        show: true,
      },
      global: {
        stubs: {
          PSheet: {
            props: ['title'],
            template: '<div class="p-sheet"><h2>{{ title }}</h2><slot /></div>',
          },
          PButton: {
            template: '<button :disabled="disabled"><slot /></button>',
            props: ['disabled', 'loading', 'variant'],
          },
          PInput: {
            template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue', 'label', 'required'],
          },
          PTextarea: {
            template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue', 'label'],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('添加图书')
    expect(wrapper.text()).toContain('第 1 步')
    expect(wrapper.text()).toContain('上传')
    expect(wrapper.text()).toContain('信息填写')
    expect(wrapper.text()).toContain('提交')
  })

  it('emits close event when close button is clicked', async () => {
    const wrapper = mount(BookCreationFlowDrawer, {
      props: {
        show: true,
      },
      global: {
        stubs: {
          PSheet: {
            template: '<div class="p-sheet"><button class="close-btn" @click="$emit(\'close\')">close</button><slot /></div>',
          },
          PButton: true,
          PInput: true,
          PTextarea: true,
        },
      },
    })

    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('progresses through step 1, 2, and 3 with full metadata', async () => {
    const wrapper = mount(BookCreationFlowDrawer, {
      props: {
        show: true,
      },
      global: {
        stubs: {
          PSheet: {
            props: ['title'],
            template: '<div class="p-sheet"><h2>{{ title }}</h2><slot /></div>',
          },
          PButton: {
            template: '<button :disabled="disabled" class="p-btn" @click="$emit(\'click\')"><slot /></button>',
            props: ['disabled', 'loading', 'variant'],
          },
          PInput: {
            template: '<div class="p-input"><label>{{ label }}</label><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" /></div>',
            props: ['modelValue', 'label', 'required'],
          },
          PTextarea: {
            template: '<div class="p-textarea"><textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
            props: ['modelValue', 'label'],
          },
        },
      },
    })

    // 模拟选择文件
    const file = new File(['dummy epub content'], '地图上的中国通史.epub', { type: 'application/epub+zip' })
    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      writable: true,
    })
    await fileInput.trigger('change')

    expect(wrapper.text()).toContain('地图上的中国通史')

    // 点击进入步骤 2
    const nextBtn = wrapper.findAll('.p-btn').find(b => b.text().includes('下一步：信息填写'))
    expect(nextBtn).toBeTruthy()
    await nextBtn!.trigger('click')

    // 确认处于第 2 步：信息填写
    expect(wrapper.text()).toContain('第 2 步：信息填写')
    expect(wrapper.text()).toContain('基础信息')
    expect(wrapper.text()).toContain('作者与创作团队')
    expect(wrapper.text()).toContain('出版与版本信息')
    expect(wrapper.text()).toContain('封面与内容简介')

    // 填写完整元数据
    const form = wrapper.find('form')
    await form.trigger('submit')

    // 确认处于第 3 步：提交
    expect(wrapper.text()).toContain('第 3 步：确认信息并提交')
    expect(wrapper.text()).toContain('确认提交并入库')

    // 点击最终提交按钮
    const submitBtn = wrapper.findAll('.p-btn').find(b => b.text().includes('确认提交并入库'))
    expect(submitBtn).toBeTruthy()
    await submitBtn!.trigger('click')
    await flushPromises()

    expect(booksApi.uploadBookFile).toHaveBeenCalled()
    expect(booksApi.createPublicBook).toHaveBeenCalledWith(expect.objectContaining({
      import_id: 'import-123',
      title: '地图上的中国通史',
    }))
    expect(vi.mocked(booksApi.uploadBookFile).mock.calls[0]?.[1]?.onProgress).toBeTypeOf('function')
    expect(wrapper.emitted('created')).toBeTruthy()
  })

  it('does not report success when public catalog creation fails', async () => {
    vi.mocked(booksApi.createPublicBook).mockRejectedValue(new Error('书目创建失败'))
    const wrapper = mount(BookCreationFlowDrawer, {
      props: { show: true },
      global: { stubs: { PSheet: true, PButton: true, PInput: true, PTextarea: true } },
    })

    const vm = wrapper.vm as any
    vm.selectedFile = new File(['epub'], 'book.epub', { type: 'application/epub+zip' })
    vm.draftTitle = '测试图书'
    vm.step = 3
    await flushPromises()
    await vm.submitCreation()

    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(vm.uploadError).toContain('书目创建失败')
  })
})
