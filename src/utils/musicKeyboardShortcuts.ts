export type MusicPlayerShortcut =
  | 'lyrics'
  | 'toggle-play'
  | 'previous'
  | 'next'
  | 'skip-back'
  | 'skip-forward'
  | 'volume-up'
  | 'volume-down'
  | 'mute'

export interface MusicShortcutContextOptions {
  activeElement?: Element | null
  showLyrics?: boolean
  showQueue?: boolean
}

/**
 * 校验当前事件是否处于输入法拼音选词状态（IME Composition）或正在输入文本。
 */
export function isInputOrIMEActive(
  event?: KeyboardEvent,
  active: Element | null = typeof document !== 'undefined' ? document.activeElement : null
): boolean {
  if (event && (event.isComposing || event.keyCode === 229)) {
    return true
  }

  if (!active || !(active instanceof HTMLElement)) return false

  const tagName = active.tagName.toLowerCase()
  if (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    active.isContentEditable ||
    Boolean(
      active.closest?.(
        '.p-editor, .dm-composer, .cm-editor, [contenteditable="true"], [role="textbox"], [role="searchbox"]'
      )
    )
  ) {
    return true
  }

  return false
}

/**
 * 判断当前焦点是否处于交互控件上（如普通按钮、标签页、滑块、复选框）。
 * 当焦点在这些控件上时，Space 键必须优先用于激活该控件，禁止被音乐播放器劫持。
 */
export function isInteractiveWidgetActive(active: Element | null): boolean {
  if (!active || !(active instanceof HTMLElement)) return false
  const tagName = active.tagName.toLowerCase()
  const role = active.getAttribute('role')

  // 播放器自身的控制器按钮除外（由播放器上下文自身统一处理）
  if (active.closest?.('.player, .audio-player, .player-mini')) {
    return false
  }

  if (tagName === 'button' || tagName === 'a' || tagName === 'summary') {
    return true
  }

  if (role && ['button', 'tab', 'checkbox', 'switch', 'menuitem', 'option', 'slider'].includes(role)) {
    return true
  }

  return false
}

/**
 * 判断当前是否处于播放器的明确交互域中（播放器获得焦点、全屏/浮层歌词打开、队列展开）。
 */
export function isPlayerActiveContext(
  options: MusicShortcutContextOptions = {},
  active: Element | null = typeof document !== 'undefined' ? document.activeElement : null
): boolean {
  if (!active || !(active instanceof HTMLElement)) {
    // 焦点丢失在 body 上时，若歌词面板在前台处于展示状态，判定为沉浸式歌词上下文
    return Boolean(options.showLyrics)
  }

  // 1. 焦点处于底栏播放器或悬浮小播放器内
  if (Boolean(active.closest?.('.player, .audio-player, .player-mini'))) {
    return true
  }

  // 2. 歌词面板打开且焦点在歌词面板内部或处于面板全局模式
  if (options.showLyrics) {
    const insideLyrics = Boolean(active.closest?.('.music-lyrics-panel'))
    const onBody = active === document.body || !active
    if (insideLyrics || onBody) return true
  }

  // 3. 队列抽屉获得焦点
  if (options.showQueue && Boolean(active.closest?.('.audio-player-queue, [data-player-queue]'))) {
    return true
  }

  return false
}

/**
 * 核心快捷键决策器：支持全局安全组合键与局部单键激活。
 */
export function resolveMusicPlayerShortcut(
  event: KeyboardEvent,
  options: MusicShortcutContextOptions = {}
): MusicPlayerShortcut | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey) return null
  if (isInputOrIMEActive(event, options.activeElement)) return null

  const key = event.key.toLowerCase()

  // ─────────────────────────────────────────────────────────────
  // 1. 全局盲操通道 (Global Blind Control - Alt + Shift + ...)
  // 无论焦点在页面的任何位置（只要不在输入框中），均可安全调用，绝不剥夺原生滚动
  // ─────────────────────────────────────────────────────────────
  if (event.altKey && event.shiftKey) {
    if (event.key === ' ' || event.code === 'Space') return 'toggle-play'
    if (event.key === 'ArrowRight') return 'next'
    if (event.key === 'ArrowLeft') return 'previous'
    if (event.key === 'ArrowUp') return 'volume-up'
    if (event.key === 'ArrowDown') return 'volume-down'
    if (key === 'm') return 'mute'
    if (key === 'l') return 'lyrics'
    return null
  }

  // Shift + F 保留作为打开/收起歌词面板的全局便捷键（对页面浏览无侵入）
  if (event.shiftKey && !event.altKey && key === 'f') {
    return 'lyrics'
  }

  // ─────────────────────────────────────────────────────────────
  // 2. 模态隔离保护：若页面存在打开的模态框/抽屉，且非播放器自身，则彻底阻断单键
  // ─────────────────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    const activeOverlay = document.querySelector(
      '.p-modal[aria-modal="true"], .p-sheet[aria-modal="true"], .p-modal-backdrop, .p-sheet-backdrop, [role="dialog"][aria-modal="true"], .p-image-lightbox'
    )
    if (activeOverlay) {
      const activeEl = options.activeElement ?? document.activeElement
      const isInsidePlayer = Boolean(
        activeEl?.closest?.('.player, .audio-player, .player-mini, .music-lyrics-panel')
      )
      if (!isInsidePlayer) return null
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. 播放器激活域单键通道 (Player Active Context - Space / Arrows / M)
  // 仅在明确聚焦播放器、展开歌词面板时生效！避免页面滚动与按钮激活被掠夺
  // ─────────────────────────────────────────────────────────────
  const isContextActive = isPlayerActiveContext(options, options.activeElement)
  if (!isContextActive) {
    // 在普通页面中，单键完全放行给浏览器原生（Space 翻页、方向键滚动、M/S 业务按键）
    return null
  }

  // 如果焦点在其它交互控件上（如普通按钮/Tab），按空格键由控件自身响应，播放器不劫持
  if (isInteractiveWidgetActive(options.activeElement ?? document.activeElement)) {
    return null
  }

  if (event.key === ' ' || event.code === 'Space') return 'toggle-play'
  if (event.key === 'ArrowLeft') return 'skip-back'
  if (event.key === 'ArrowRight') return 'skip-forward'
  if (event.key === 'ArrowUp') return 'volume-up'
  if (event.key === 'ArrowDown') return 'volume-down'
  if (key === 'm') return 'mute'

  return null
}

/**
 * 兼容原有接口，判断当前目标是否被阻断
 */
export function isMusicKeyboardShortcutTargetBlocked(
  active: Element | null = typeof document !== 'undefined' ? document.activeElement : null
): boolean {
  if (!active || !(active instanceof HTMLElement)) return false

  if (isInputOrIMEActive(undefined, active)) return true

  // 1. 焦点位于弹窗、抽屉、提示对话框或图片灯箱内部
  if (
    Boolean(
      active.closest?.(
        '[role="dialog"], [role="alertdialog"], .p-modal, .p-sheet, .p-lightbox, .p-image-lightbox'
      )
    )
  ) {
    return true
  }

  // 2. 焦点位于全局搜索浮层、下拉浮层、通知气泡
  if (
    Boolean(
      active.closest?.(
        '.app-topbar-global-search, .notification-popover, [data-dropdown], [role="menu"]'
      )
    )
  ) {
    return true
  }

  // 3. 页面全局存在打开状态的模态背景或具有 aria-modal="true" 的弹层
  if (typeof document !== 'undefined') {
    const activeOverlay = document.querySelector(
      '.p-modal[aria-modal="true"], .p-sheet[aria-modal="true"], .p-modal-backdrop, .p-sheet-backdrop, [role="dialog"][aria-modal="true"], .p-image-lightbox'
    )
    if (activeOverlay) {
      const isInsidePlayer = Boolean(
        active.closest?.('.player, .audio-player, .player-mini, .music-lyrics-panel')
      )
      if (!isInsidePlayer) {
        return true
      }
    }
  }

  return false
}
