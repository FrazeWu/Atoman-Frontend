import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appVersion } from '@/config/appVersion'
import { footbarLinks } from '@/config/moduleRooms'
import SiteFooter from '@/components/system/SiteFooter.vue'
import router from '@/router'

const footerSource = readFileSync(resolve(__dirname, '../../../src/components/system/SiteFooter.vue'), 'utf8')

const mountFooter = () => {
  const wrapper = mount(SiteFooter, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
        },
      },
    },
  })
  document.body.appendChild(wrapper.element)
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  vi.restoreAllMocks()
})

describe('SiteFooter', () => {
  it('renders the confirmed two-level footbar content', () => {
    const wrapper = mountFooter()

    expect(footbarLinks.map((link) => link.label)).toEqual([
      '关于',
      '联系我们',
      '问题反馈',
      '使用条款',
      '隐私政策',
    ])
    expect(wrapper.get('.site-footer-primary').text()).toContain('凹凸庵')
    expect(wrapper.get('.site-footer-primary').text()).toContain('关于')
    expect(wrapper.get('.site-footer-primary').text()).toContain('联系我们')
    expect(wrapper.get('.site-footer-primary').text()).toContain('问题反馈')
    expect(wrapper.get('.site-footer-secondary').text()).toContain(`© ${new Date().getFullYear()} 凹凸庵`)
    expect(wrapper.get('.site-footer-secondary').text()).toContain('使用条款')
    expect(wrapper.get('.site-footer-secondary').text()).toContain('隐私政策')
    expect(wrapper.get('.site-footer-version').text()).toBe(appVersion)
  })

  it('does not reserve mobile navigation space below the footer', () => {
    expect(footerSource).not.toContain('+ 96px')
  })

  it('stays fixed to the bottom of the main content area', () => {
    expect(footerSource).toContain('position: fixed')
    expect(footerSource).toContain('right: 0')
    expect(footerSource).toContain('bottom: 0')
    expect(footerSource).toContain('left: var(--a-sidebar-width)')
    expect(footerSource).toContain('height: var(--a-footer-reserved-height)')
  })

  it('uses the confirmed compact two-row layout', () => {
    expect(footerSource).toContain('height: 100%')
    expect(footerSource).toContain('padding: 0 var(--a-space-6)')
    expect(footerSource).toContain('flex: 1')
    expect(footerSource).toContain('min-height: 44px')
  })

  it('keeps footer sheets within the viewport above fixed bottom UI', () => {
    const sheetSource = readFileSync(resolve(__dirname, '../../../src/components/system/footer/SiteFooterSheet.vue'), 'utf8')

    expect(sheetSource).toContain('calc(100dvh - var(--a-content-bottom-offset))')
  })

  it('uses the canonical site setting destination', () => {
    expect(footerSource).toContain('to="/site/setting"')
    expect(footerSource).not.toContain('to="/setting"')
  })

  it('uses the topbar short-line motif instead of full-width borders', () => {
    expect(footerSource).not.toContain('border-top: var(--a-border)')
    expect(footerSource).toContain('.site-footer::before')
    expect(footerSource).toContain('width: 20px')
    expect(footerSource).toContain('background-color: var(--a-color-ink)')
  })

  it('extends the centered divider with two subtle side lines', () => {
    expect(footerSource).toContain('.site-footer::after')
    expect(footerSource).toContain('width: 68px')
    expect(footerSource).toContain('opacity: 0.45')
    expect(footerSource).toContain('var(--a-color-ink) 0 12px')
    expect(footerSource).toContain('transparent 12px 56px')
    expect(footerSource).toContain('var(--a-color-ink) 56px 68px')
  })

  it('enters the glass state when the page scrolls', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const wrapper = mountFooter()

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1 })
    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()

    expect(wrapper.classes()).toContain('is-scrolled')
  })

  it('mirrors the topbar glass and divider transitions', () => {
    expect(footerSource).toContain('.site-footer.is-scrolled {')
    expect(footerSource).toContain('background: color-mix(in srgb, var(--a-color-bg) 80%, transparent)')
    expect(footerSource).toContain('backdrop-filter: blur(12px)')
    expect(footerSource).toContain('.site-footer.is-scrolled::before')
    expect(footerSource).toContain('width: 75%')
    expect(footerSource).toContain('.site-footer.is-scrolled::after')
    expect(footerSource).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it.each([
    ['about', '关于凹凸庵', '我们希望打造一个纯粹、求真的网络空间。'],
    ['contact', '联系我们', 'support@atoman.org'],
    ['feedback', '问题反馈', '发送给 @fazong'],
    ['terms', '使用条款', '不得发布违反良法、侵权的内容。'],
    ['privacy', '隐私政策', '目前并非端到端加密'],
  ])('opens the %s bottom sheet with its confirmed content', async (panel, title, content) => {
    const wrapper = mountFooter()

    await wrapper.get(`[data-footer-panel="${panel}"]`).trigger('click')

    const sheet = wrapper.get('.site-footer-sheet')
    expect(sheet.classes()).toContain('is-bottom')
    expect(sheet.attributes('role')).toBe('dialog')
    expect(sheet.text()).toContain(title)
    expect(sheet.text()).toContain(content)
  })

  it('uses the confirmed destinations for source code and feedback', async () => {
    const wrapper = mountFooter()

    await wrapper.get('[data-footer-panel="about"]').trigger('click')
    expect(wrapper.get('[data-footer-action="source"]').attributes('href')).toBe('https://github.com/FrazeWu/Atoman')
    await wrapper.get('[aria-label^="关闭"]').trigger('click')

    await wrapper.get('[data-footer-panel="feedback"]').trigger('click')
    expect(wrapper.get('[data-footer-action="github-issues"]').attributes('href')).toBe('https://github.com/FrazeWu/Atoman/issues')
    expect(wrapper.get('[data-footer-action="message-owner"]').attributes('href')).toBe('/inbox?tab=dm&user=fazong')
  })

  it('copies the support email from the contact sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mountFooter()

    await wrapper.get('[data-footer-panel="contact"]').trigger('click')
    await wrapper.get('[data-footer-action="copy-email"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('support@atoman.org')
    expect(wrapper.text()).toContain('邮箱已复制')
  })

  it('restores focus to the triggering link after the sheet closes', async () => {
    vi.useFakeTimers()
    const wrapper = mountFooter()
    const trigger = wrapper.get<HTMLButtonElement>('[data-footer-panel="about"]')
    trigger.element.focus()

    await trigger.trigger('click')
    await wrapper.get('[aria-label="关闭关于"]').trigger('click')
    vi.runAllTimers()

    expect(document.activeElement).toBe(trigger.element)
    vi.useRealTimers()
  })

  it('keeps direct routes for shareable public information', () => {
    expect(router.resolve('/about').matched.length).toBeGreaterThan(0)
    expect(router.resolve('/terms').matched.length).toBeGreaterThan(0)
    expect(router.resolve('/privacy').matched.length).toBeGreaterThan(0)
  })
})
