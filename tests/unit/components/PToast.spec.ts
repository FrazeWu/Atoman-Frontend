import { mount } from '@vue/test-utils'
import { beforeEach } from 'vitest'

import PToast from '@/components/ui/PToast.vue'

describe('PToast', () => {
  beforeEach(() => document.body.replaceChildren())

  const renderedToast = () => document.body.querySelector<HTMLElement>('.p-toast')

  it('renders info toast by default', () => {
    mount(PToast, {
      props: {
        message: 'Hello World',
        modelValue: true,
      },
    })
    expect(renderedToast()?.classList).toContain('p-toast--info')
    expect(renderedToast()?.textContent).toContain('Hello World')
  })

  it('renders success toast with correct class', () => {
    mount(PToast, {
      props: {
        message: 'Success Message',
        type: 'success',
        modelValue: true,
      },
    })
    expect(renderedToast()?.classList).toContain('p-toast--success')
  })

  it('renders danger toast with correct class', () => {
    mount(PToast, {
      props: {
        message: 'Error Message',
        type: 'danger',
        modelValue: true,
      },
    })
    expect(renderedToast()?.classList).toContain('p-toast--danger')
  })

  it('renders warning toast with correct class', () => {
    mount(PToast, {
      props: {
        message: '需要重试',
        type: 'warning',
        modelValue: true,
      },
    })

    expect(renderedToast()?.classList).toContain('p-toast--warning')
  })
})
