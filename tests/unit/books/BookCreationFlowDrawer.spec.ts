import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BookCreationFlowDrawer from '@/components/books/BookCreationFlowDrawer.vue'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { id: 'u1', username: 'testuser' },
  }),
}))

vi.mock('@/api/books', () => ({
  uploadBookFile: vi.fn().mockResolvedValue({ id: 'import-123', status: 'uploaded' }),
  submitBookEdit: vi.fn().mockResolvedValue({ id: 'edit-123' }),
  submitPublicationRequest: vi.fn().mockResolvedValue({ id: 'pub-123' }),
}))

describe('BookCreationFlowDrawer', () => {
  it('renders correctly when open', () => {
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
})
